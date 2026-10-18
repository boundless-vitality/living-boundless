import { APP_NAME, planCode, planIssuedLine } from '@lb/shared';
import type { Plan } from '@lb/shared';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { downloadBlob } from './storage';

export interface Output {
  plan: Plan;
  link: string;
}

export function OutputsPanel({ errors, output, stale, onCreate, patientName, toast }: {
  errors: string[];
  output?: Output;
  stale: boolean;
  onCreate: () => void;
  patientName: string;
  toast: (s: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (output && canvas.current) {
      QRCode.toCanvas(canvas.current, output.link, { errorCorrectionLevel: 'L', margin: 2, scale: 6, color: { dark: '#1c1b19', light: '#ffffff' } });
    }
  }, [output]);

  const copy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output.link);
    toast('Link copied. Paste it into Spruce.');
  };

  const downloadQr = async () => {
    if (!output) return;
    const url = await QRCode.toDataURL(output.link, { errorCorrectionLevel: 'L', margin: 3, scale: 10 });
    const blob = await (await fetch(url)).blob();
    downloadBlob(blob, `plan-qr_v${output.plan.version}_${planCode(output.plan.id)}.png`);
  };

  const downloadPdf = async () => {
    if (!output) return;
    setBusy(true);
    try {
      // The PDF library is large, so it loads only when needed.
      const { buildPlanPdf, pdfFilename } = await import('./pdf');
      const bytes = await buildPlanPdf(output.plan, output.link, patientName);
      downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), pdfFilename(output.plan, patientName));
    } catch (e) {
      console.error(e);
      toast("Couldn't make the PDF. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="side">
      <section className="card">
        <h2>send the plan</h2>
        {errors.length > 0 && (
          <div className="errors" style={{ marginBottom: 12 }}>
            A few things to fix first:
            <ul>{errors.slice(0, 8).map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}
        {output && stale && (
          <div className="stale" style={{ marginBottom: 12 }}>
            You've changed the plan since this link was made. Create the link again to send the update.
          </div>
        )}
        <button className="primary big" disabled={errors.length > 0} onClick={onCreate}>
          {output && !stale ? 'Link is up to date' : output ? 'Create updated link' : 'Create plan link'}
        </button>
        {!output && (
          <p className="small muted" style={{ marginBottom: 0 }}>
            Makes the link, QR code and chart PDF. Nothing is uploaded: the whole plan lives inside the link.
          </p>
        )}
      </section>

      {output && (
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: stale ? 0.55 : 1 }}>
          <div className="stamp">
            <span className="pill">v{output.plan.version}</span>
            <span className="pill">{planCode(output.plan.id)}</span>
            <span className="muted small">{planIssuedLine(output.plan)}</span>
          </div>
          <div className="qr">
            <canvas ref={canvas} aria-label="Plan QR code" />
          </div>
          <p className="small muted" style={{ margin: 0, textAlign: 'center' }}>
            In the office: patient opens {APP_NAME} → Add plan → Scan QR.
          </p>
          <label className="field">
            Plan link ({output.link.length.toLocaleString()} characters)
            <textarea className="linkbox" readOnly value={output.link} onFocus={(e) => e.currentTarget.select()} />
          </label>
          <div className="row">
            <button className="primary" onClick={copy}>Copy link</button>
            <button onClick={downloadPdf} disabled={busy}>{busy ? 'Making PDF…' : 'Download PDF'}</button>
            <button onClick={downloadQr}>Save QR image</button>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            Virtual consult: paste the link (or attach the QR image) in Spruce. Upload the PDF to the chart.
          </p>
        </section>
      )}
    </aside>
  );
}
