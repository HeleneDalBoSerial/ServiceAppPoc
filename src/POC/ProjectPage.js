import React, { useState } from "react";
import { ChatScreen } from "./ChatScreen";
import { useSelector } from "react-redux";
import CallHeader from "./CallHeader";

function ProjectPage() {
  const token = useSelector((state) => state.poc.token);
  const userId = useSelector((state) => state.poc.communicationUserId);
  const displayName = useSelector((state) => state.poc.displayName);
  const threadId = "19:CanUHM_SHC7IJmf1qMyWhjABG78SIrFDXP7kLphRHqc1@thread.v2";
  const endpointUrl = "https://acs-ptc-poc.communication.azure.com/";
  const [userJoinedThread, setUserJoinedThread] = useState(true);

  return (
    <>
      <CallHeader />
      <div className="card">
        {userJoinedThread && (
          <ChatScreen
            token={token}
            userId={userId}
            displayName={displayName}
            endpointUrl={endpointUrl}
            threadId={threadId}
            endChatHandler={(isParticipantRemoved) => {}}
          />
        )}
      </div>
    </>
  );
}

export default ProjectPage;
