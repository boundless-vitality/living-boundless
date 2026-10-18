// Preset compression dictionary: words and JSON fragments that show up in most plans.
// The compressor can point back into this text instead of spelling words out, which
// shrinks links noticeably. FROZEN for format p1: changing even one character breaks
// every p1 link already sent. Add a new dictionary under a new FORMAT instead.
// Most common fragments go last (deflate finds nearer matches cheaper).
export const DICTIONARY = [
  'cottage cheese, Greek yogurt, egg whites, tofu, tempeh, shrimp, cod, tilapia, tuna, ground turkey, lean beef, sirloin, steak, pork tenderloin, bison, ',
  'salmon, sardines, whole eggs, chicken thighs, ribeye, ',
  'quinoa, brown rice, white rice, jasmine rice, oats, oatmeal, sweet potato, potato, ezekiel bread, sourdough, rice cakes, beans, lentils, chickpeas, ',
  'banana, berries, blueberries, strawberries, apple, orange, dates, pineapple, mango, grapes, honey, ',
  'avocado, olive oil, coconut oil, butter, ghee, almonds, walnuts, cashews, pistachios, peanut butter, almond butter, chia seeds, flax, cheese, ',
  'spinach, broccoli, asparagus, zucchini, cauliflower, green beans, peppers, salad, mixed greens, cucumber, ',
  'protein shake, protein bar, whey, collagen, electrolytes, ',
  'Vitamin D3, magnesium glycinate, omega-3, fish oil, creatine, probiotic, multivitamin, B complex, ',
  'with breakfast, with lunch, with dinner, morning, bedtime, before bed, on an empty stomach, 1 capsule, 2 capsules, 5 g, ',
  'Low-Carb Day, High-Carb Day, Training Day, Rest Day, Travel Day, Week 1, Week 2, Week 3, Week 4, ',
  'within 30 minutes after strength training, ',
  ' or ',
  'Pre-Workout', 'Post-Workout', 'Snack 1', 'Snack 2', 'Snack 3',
  '{"i":', '"Breakfast","s":', '"Lunch","s":', '"Dinner","s":', '"Snack","s":', ',"e":', ',"g":', ',"c":[[0,1,', ',"c":[[0,2,', '],[1,3,', '],[1,5,', '],[2,0,', '],[3,0,1,2', '],[3]]', ',"m":[[["', ',"n":"', '}]],[', '"p":[[1,"', '"c":[1,[', '"c":[2,[[', '"u":[["', '"w":[', '"f":[',
  ',1]', ',2]', ',3]', ',4]', ',5]', ',6]', '],[', '"],["', '","', '},{"i":',
].join('');
