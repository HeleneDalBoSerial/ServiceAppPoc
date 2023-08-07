import React, { useCallback } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Persona, PersonaSize } from "@fluentui/react/lib/Persona";
import { RouteConfig } from "../routes";
import Header from "./Header";
import { utils } from "../Utils/Utils";

function ProjectsPage() {
  const loggedIn = useSelector((state) => state.poc.loggedIn);
  const navigate = useNavigate();

  const token = useSelector((state) => state.poc.token);
  const userId = useSelector((state) => state.poc.communicationUserId);
  const displayName = useSelector((state) => state.poc.displayName);
  const threadId = "19:CanUHM_SHC7IJmf1qMyWhjABG78SIrFDXP7kLphRHqc1@thread.v2";
  const projectData = useSelector((state) => state.poc.projectData);

  const setupAndJoinChatThreadWithNewUser = useCallback(() => {
    const internalSetupAndJoinChatThread = async () => {
      const result = await utils.joinThread(
        threadId,
        userId,
        displayName,
        token
      );
      if (!result) {
        return;
      }
      navigate(RouteConfig.project);
    };
    internalSetupAndJoinChatThread();
  }, [token, userId, displayName, threadId]);

  const redirectToProjectPage = () => {
    setupAndJoinChatThreadWithNewUser();
  };

  return (
    <>
      <Header />
      <div className="card">
        <div className="ms-Grid">
          <div>
            <div className="ms-Grid-row">
              <div className="ms-Grid-col">
                <h3>My projects</h3>
              </div>
            </div>
            <div className="ms-Grid-row mt-3">
              <div
                className="ms-Grid-col ms-sm12 ms-md12 ms-lg12 project"
                onClick={redirectToProjectPage}
              >
                <Persona {...projectData} size={PersonaSize.size56} />
              </div>
            </div>
          </div>
        </div>
        {!loggedIn && <Navigate to="/" replace={true} />}
      </div>
    </>
  );
}

export default ProjectsPage;
