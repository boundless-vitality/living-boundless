// Brand fonts, bundled with the site (no font CDN). The same files feed the PDF.
import leagueBold from '@expo-google-fonts/league-spartan/700Bold/LeagueSpartan_700Bold.ttf?url';
import sansLight from '@expo-google-fonts/source-sans-3/300Light/SourceSans3_300Light.ttf?url';
import sansRegular from '@expo-google-fonts/source-sans-3/400Regular/SourceSans3_400Regular.ttf?url';
import sansItalic from '@expo-google-fonts/source-sans-3/400Regular_Italic/SourceSans3_400Regular_Italic.ttf?url';
import sansSemi from '@expo-google-fonts/source-sans-3/600SemiBold/SourceSans3_600SemiBold.ttf?url';

export const FONT_URLS = { leagueBold, sansLight, sansRegular, sansItalic, sansSemi };

export function installFonts(): void {
  const css = `
@font-face { font-family: 'League Spartan'; font-weight: 700; src: url(${leagueBold}) format('truetype'); font-display: swap; }
@font-face { font-family: 'Source Sans 3'; font-weight: 300; src: url(${sansLight}) format('truetype'); font-display: swap; }
@font-face { font-family: 'Source Sans 3'; font-weight: 400; src: url(${sansRegular}) format('truetype'); font-display: swap; }
@font-face { font-family: 'Source Sans 3'; font-weight: 400; font-style: italic; src: url(${sansItalic}) format('truetype'); font-display: swap; }
@font-face { font-family: 'Source Sans 3'; font-weight: 600; src: url(${sansSemi}) format('truetype'); font-display: swap; }`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}
