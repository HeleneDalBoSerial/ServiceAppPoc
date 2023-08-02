import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  loggedIn: false,
  token: null,
  communicationUserId: null,
  displayName: null,
  inCall: false,
  callAgent: null,
  callClient: null,
  deviceManager: null,
  call: null,
  identityMri: null,
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
    setInCall: (state, action) => {
      state.inCall = action.payload;
    },
    setCallAgent: (state, action) => {
      state.callAgent = action.payload;
    },
    setCallClient: (state, action) => {
      state.callClient = action.payload;
    },
    setDeviceManager: (state, action) => {
      state.deviceManager = action.payload;
    },
    setCall: (state, action) => {
      state.call = action.payload;
    },
    setIdentityMri: (state, action) => {
      state.identityMri = action.payload;
    },
  },
});

export const {
  setIsLoggedIn,
  setToken,
  setCommunicationUserId,
  setDisplayName,
  setInCall,
  setCallAgent,
  setCallClient,
  setDeviceManage,
  setCall,
  setIdentityMri,
  setDeviceManager,
} = pocSlice.actions;

export default pocSlice.reducer;
