import { AzureCommunicationTokenCredential } from "@azure/communication-common";

const postRefreshTokenParameters = {
  method: "POST",
};

/**
 * Create credentials that auto-refresh asynchronously.
 */
export const createAutoRefreshingCredential = (userId, token) => {
  const options = {
    token: token,
    tokenRefresher: refreshTokenAsync(userId),
    refreshProactively: true,
  };

  return new AzureCommunicationTokenCredential(options);
};

const refreshTokenAsync = (userIdentity) => {
  return async () => {
    const response = await fetch(
      `/refreshToken/${userIdentity}`,
      postRefreshTokenParameters
    );
    if (response.ok) {
      return (await response.json()).token;
    } else {
      throw new Error("could not refresh token");
    }
  };
};
