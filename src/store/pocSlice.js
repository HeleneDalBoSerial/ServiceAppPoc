import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  loggedIn: false,
};

export const pocSlice = createSlice({
  name: "poc",
  initialState,
  reducers: {
    setIsLoggedIn: (state, action) => {
      state.loggedIn = action.payload;
    },
  },
});

export const { setIsLoggedIn } = pocSlice.actions;

export default pocSlice.reducer;
