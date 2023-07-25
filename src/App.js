import React from "react";
import "./App.css";
import { initializeIcons } from "@uifabric/icons";
import { ToastContainer } from "react-toastify";
import { Routes, useLocation } from "react-router-dom";
import appRoutes from "./routes";

initializeIcons();

function VWebSdkVersion() {
  return require("../package.json").dependencies[
    "@azure/communication-calling"
  ];
}

function App() {
  const location = useLocation();

  return (
    <div className="App">
      <ToastContainer />
      <Routes location={location}>{appRoutes}</Routes>
    </div>
  );
}

export default App;
