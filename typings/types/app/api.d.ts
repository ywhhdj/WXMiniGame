declare namespace API {
  type OpenIdResponse={
    openid:string,
    appid:string,
    unionid:string
  }
  interface CloudResponse<T> {
    success: boolean;
    errMsg?: string;
    data?: T ;
  }
  interface CloudGameData {
    currentRole: AppGame.Role | null;
    roles: Record<string, AppGame.Role>;
    saves: AppUI.ArchiveItem[];
    achievements: string[];
    endings: { sceneId: string; endingKey: string }[];
  }
}