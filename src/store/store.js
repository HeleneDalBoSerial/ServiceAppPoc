import { configureStore } from "@reduxjs/toolkit";
import pocReducer from "./pocSlice";

export const store = configureStore({
  reducer: {
    poc: pocReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});
