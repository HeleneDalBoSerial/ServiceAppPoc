import * as React from "react";
import { Route } from "react-router-dom";
import LoginPage from "./POC/LoginPage";
import ProjectsPage from "./POC/ProjectsPage";

export const RouteParams = {
  backPaths: "backPaths",
};

export const RouteConfig = {
  login: "/",
  projects: "/projects",
};

// eslint-disable-next-line import/no-anonymous-default-export
export default [
  <Route path={RouteConfig.login} element={<LoginPage />} key="login" />,
  <Route
    path={RouteConfig.projects}
    element={<ProjectsPage />}
    key="projects"
  />,
];
