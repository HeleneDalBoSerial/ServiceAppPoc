/* eslint-disable react/prop-types */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  ChatComposite,
  fromFlatCommunicationIdentifier,
  toFlatCommunicationIdentifier,
  useAzureCommunicationChatAdapter,
} from "@azure/communication-react";
import { Stack } from "@fluentui/react";
import React, { useCallback, useEffect, useMemo } from "react";

import { ChatHeader } from "./ChatHeader";
import {
  chatCompositeContainerStyle,
  chatScreenContainerStyle,
} from "../styles/ChatScreen.styles";
import { createAutoRefreshingCredential } from "../Utils/credential";

export const ChatScreen = (props) => {
  const { displayName, endpointUrl, threadId, token, userId, endChatHandler } =
    props;

  const adapterAfterCreate = useCallback(
    async (adapter) => {
      adapter.on("participantsRemoved", (listener) => {
        const removedParticipantIds = listener.participantsRemoved.map((p) =>
          toFlatCommunicationIdentifier(p.id)
        );
        if (removedParticipantIds.includes(userId)) {
          const removedBy = toFlatCommunicationIdentifier(
            listener.removedBy.id
          );
          endChatHandler(removedBy !== userId);
        }
      });
      adapter.on("error", (e) => {
        console.error(e);
      });
      return adapter;
    },
    [endChatHandler, userId]
  );

  const adapterArgs = useMemo(
    () => ({
      endpoint: endpointUrl,
      userId: fromFlatCommunicationIdentifier(userId),
      displayName,
      credential: createAutoRefreshingCredential(userId, token),
      threadId,
    }),

    [endpointUrl, userId, displayName, token, threadId]
  );

  const adapter = useAzureCommunicationChatAdapter(
    adapterArgs,
    adapterAfterCreate
  );

  // Dispose of the adapter in the window's before unload event
  useEffect(() => {
    const disposeAdapter = () => adapter?.dispose();
    window.addEventListener("beforeunload", disposeAdapter);
    return () => window.removeEventListener("beforeunload", disposeAdapter);
  }, [adapter]);

  if (adapter) {
    console.log(
      `displayName: ${displayName}, endpointUrl: ${endpointUrl}, threadId: ${threadId}, token: ${token}, userId: ${userId}`
    );

    return (
      <Stack className={chatScreenContainerStyle}>
        <Stack.Item className={chatCompositeContainerStyle} role="main">
          <ChatComposite
            adapter={adapter}
            options={{
              autoFocus: "sendBoxTextField",
              topic: false,
            }}
          />
        </Stack.Item>
        <ChatHeader onEndChat={() => adapter.removeParticipant(userId)} />
      </Stack>
    );
  }
  return <>Initializing...</>;
};
