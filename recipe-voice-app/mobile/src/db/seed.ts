import { getDb } from "./schema";
import { createRecipe, RecipeInput } from "./recipeQueries";

const SAMPLE_RECIPES: RecipeInput[] = [
  {
    title: "김치찌개",
    totalTimeMinutes: 25,
    servings: 2,
    source: "manual",
    ingredients: [
      { name: "김치", quantity: 200, unit: "그램" },
      { name: "돼지고기", quantity: 100, unit: "그램" },
      { name: "두부", quantity: 0.5, unit: "모" },
      { name: "대파", quantity: 1, unit: "대" },
      { name: "고춧가루", quantity: 1, unit: "큰술" },
      { name: "다진마늘", quantity: 1, unit: "작은술" },
    ],
    steps: [
      { text: "팬에 기름을 두르고 돼지고기를 볶는다.", timerSeconds: null },
      { text: "김치를 넣고 5분 정도 더 볶는다.", timerSeconds: 300 },
      { text: "물을 붓고 끓인다.", timerSeconds: null },
      { text: "두부와 대파를 넣고 10분간 더 끓인다.", timerSeconds: 600 },
    ],
    tags: ["한식", "찌개", "돼지고기"],
  },
  {
    title: "된장찌개",
    totalTimeMinutes: 20,
    servings: 2,
    source: "manual",
    ingredients: [
      { name: "된장", quantity: 2, unit: "큰술" },
      { name: "애호박", quantity: 0.5, unit: "개" },
      { name: "감자", quantity: 1, unit: "개" },
      { name: "양파", quantity: 0.5, unit: "개" },
      { name: "두부", quantity: 0.5, unit: "모" },
      { name: "청양고추", quantity: 1, unit: "개" },
    ],
    steps: [
      { text: "쌀뜨물에 된장을 풀어 끓인다.", timerSeconds: null },
      { text: "감자와 양파를 넣고 5분간 끓인다.", timerSeconds: 300 },
      { text: "애호박, 두부, 청양고추를 넣고 5분 더 끓인다.", timerSeconds: 300 },
    ],
    tags: ["한식", "찌개"],
  },
  {
    title: "계란볶음밥",
    totalTimeMinutes: 10,
    servings: 1,
    source: "manual",
    ingredients: [
      { name: "밥", quantity: 1, unit: "공기" },
      { name: "계란", quantity: 2, unit: "개" },
      { name: "대파", quantity: 0.5, unit: "대" },
      { name: "간장", quantity: 1, unit: "큰술" },
      { name: "식용유", quantity: 1, unit: "큰술" },
    ],
    steps: [
      { text: "팬에 기름을 두르고 계란을 스크램블한다.", timerSeconds: null },
      { text: "밥과 대파를 넣고 3분간 함께 볶는다.", timerSeconds: 180 },
      { text: "간장으로 간을 맞추고 마무리한다.", timerSeconds: null },
    ],
    tags: ["한식", "볶음밥", "간단요리"],
  },
  {
    title: "떡볶이",
    totalTimeMinutes: 20,
    servings: 2,
    source: "manual",
    ingredients: [
      { name: "떡", quantity: 300, unit: "그램" },
      { name: "어묵", quantity: 100, unit: "그램" },
      { name: "고추장", quantity: 2, unit: "큰술" },
      { name: "고춧가루", quantity: 1, unit: "큰술" },
      { name: "설탕", quantity: 1, unit: "큰술" },
      { name: "대파", quantity: 1, unit: "대" },
    ],
    steps: [
      { text: "물에 고추장, 고춧가루, 설탕을 풀어 끓인다.", timerSeconds: null },
      { text: "떡과 어묵을 넣고 8분간 끓인다.", timerSeconds: 480 },
      { text: "대파를 넣고 2분 더 끓인다.", timerSeconds: 120 },
    ],
    tags: ["한식", "분식", "매운맛"],
  },
  {
    title: "김치볶음밥",
    totalTimeMinutes: 15,
    servings: 1,
    source: "manual",
    ingredients: [
      { name: "밥", quantity: 1, unit: "공기" },
      { name: "김치", quantity: 150, unit: "그램" },
      { name: "돼지고기", quantity: 50, unit: "그램" },
      { name: "계란", quantity: 1, unit: "개" },
      { name: "식용유", quantity: 1, unit: "큰술" },
    ],
    steps: [
      { text: "팬에 기름을 두르고 돼지고기를 볶는다.", timerSeconds: null },
      { text: "김치를 넣고 3분간 볶는다.", timerSeconds: 180 },
      { text: "밥을 넣고 골고루 섞어가며 3분간 볶는다.", timerSeconds: 180 },
      { text: "계란프라이를 올려 완성한다.", timerSeconds: null },
    ],
    tags: ["한식", "볶음밥", "김치"],
  },
];

/** 앱을 처음 켰을 때(레시피가 하나도 없을 때만) 테스트용 샘플 레시피 5개를 미리 채워 넣는다. */
export async function seedSampleRecipesIfEmpty(): Promise<void> {
  const db = getDb();
  // deleted_at 필터를 걸지 않는다 — 사용자가 샘플 5개를 전부 지운 뒤 다시 켰을 때
  // "레시피가 하나도 없다"고 오판해서 재시딩하는 걸 막기 위함. 앱을 최초로 켠 뒤로
  // 한 번이라도 레시피가 만들어졌다면(삭제 포함) 다시 심지 않는다.
  const existing = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM recipes"
  );
  if ((existing?.count ?? 0) > 0) return;

  for (const recipe of SAMPLE_RECIPES) {
    await createRecipe(recipe);
  }
}
