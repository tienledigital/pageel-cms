// @para-doc [#csa-cms-app-int-types]
export interface BridgeVerificationResponse {
  success: boolean;
  user: {
    id: string;
    email: string;
    role: string;
  };
  config: {
    githubToken: string;
    repoOwner: string;
    repoName: string;
  };
}
