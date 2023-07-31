import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  loggedIn: false,
  token: null,
  communicationUserId: null,
  displayName: null,
};

export const pocSlice = createSlice({
  name: "poc",
  initialState,
  reducers: {
    setIsLoggedIn: (state, action) => {
      state.loggedIn = action.payload;
    },
    setToken: (state, action) => {
      state.token = action.payload;
    },
    setCommunicationUserId: (state, action) => {
      state.communicationUserId = action.payload;
    },
    setDisplayName: (state, action) => {
      state.displayName = action.payload;
    },
  },
});

export const {
  setIsLoggedIn,
  setToken,
  setCommunicationUserId,
  setDisplayName,
} = pocSlice.actions;

export default pocSlice.reducer;
