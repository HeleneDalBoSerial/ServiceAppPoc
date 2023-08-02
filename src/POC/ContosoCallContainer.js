/* eslint-disable react/prop-types */
import { AzureCommunicationTokenCredential } from "@azure/communication-common";
import {
  CallComposite,
  useAzureCommunicationCallAdapter,
} from "@azure/communication-react";
import React, { useMemo, useState } from "react";

export const ContosoCallContainer = (props) => {
  const [options] = useState({
    localVideoTileOptions: { position: "floating" },
  });

  const credential = useMemo(() => {
    try {
      return new AzureCommunicationTokenCredential(props.token);
    } catch {
      console.error("Failed to construct token credential");
      return undefined;
    }
  }, [props.token]);

  const adapter = useAzureCommunicationCallAdapter(
    {
      userId: { communicationUserId: props.userId },
      displayName: props.displayName, // Max 256 Characters
      credential,
      locator: props.roomId
        ? {
            roomId: props.roomId,
          }
        : undefined,
    },
    undefined,
    leaveCall
  );

  if (!props.roomId) {
    return <>Room id is not provided.</>;
  }

  if (adapter) {
    return (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: "90vh",
          width: "90vw",
        }}
      >
        <CallComposite
          adapter={adapter}
          formFactor="mobile"
          options={options}
        />
      </div>
    );
  }
  if (credential === undefined) {
    return <>Failed to construct credential. Provided token is malformed.</>;
  }
  return <>Initializing...</>;
};

const leaveCall = async (adapter) => {
  await adapter.leaveCall().catch((e) => {
    console.error("Failed to leave call", e);
  });
};
