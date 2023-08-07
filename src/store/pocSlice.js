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
  projectData: {
    imageUrl:
      "data:image/jpeg;base64,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",
    imageInitials: "TM",
    text: "Turbine Maintenance",
    secondaryText: "In progress",
  },
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
