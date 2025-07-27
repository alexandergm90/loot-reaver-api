export interface FacebookPictureData {
  height: number;
  is_silhouette: boolean;
  url: string;
  width: number;
}

export interface FacebookProfile {
  id: string;
  name?: string;
  email?: string;
  picture?: {
    data: FacebookPictureData;
  };
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    // optionally: username, email, roles, etc.
  };
}