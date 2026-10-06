import { create } from "zustand";
import { searchRecipes, RecipeSummary } from "../db/recipeQueries";

interface RecipeStoreState {
  recipes: RecipeSummary[];
  isLoading: boolean;
  /** term이 빈 문자열이면 searchRecipes가 전체 목록을 반환하므로 "전체 로드"도 이 함수 하나로 처리한다. */
  search: (term: string) => Promise<void>;
}

export const useRecipeStore = create<RecipeStoreState>((set) => ({
  recipes: [],
  isLoading: false,
  search: async (term: string) => {
    set({ isLoading: true });
    try {
      const recipes = await searchRecipes(term);
      set({ recipes });
    } finally {
      set({ isLoading: false });
    }
  },
}));
