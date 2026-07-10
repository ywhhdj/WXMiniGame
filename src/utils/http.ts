const send = <T = any>(
  request: {
    type: string;
    data?: Record<string, any>;
  }
):Promise<API.CloudResponse<T>> => {
  return new Promise((
    resolve:(res:API.CloudResponse<T>)=>void,
    reject:(err:string)=>void
    ) => {
    wx.cloud
    .callFunction({
      name: "quickstartFunctions",
      data: {
        type: request.type,
        data: request.data,
      },
    })
    .then((res) => {
      if (res.result) {
        let result=res.result as string|API.CloudResponse<T>;
        if(typeof result==="string"){
          result=JSON.parse(result) as API.CloudResponse<T>
        }else{
          result=result as API.CloudResponse<T>
        }
        resolve(result);
      } else {
        reject(res.errMsg);
      }
    })
    .catch((err) => {
      reject(err);
    })
  });
}

export function getLocalJSONFile<T=any>(filePath: string):Promise<T> {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      encoding: 'utf8',
      success: (res) => {
        if(res.errMsg!=="readFile:ok"){
          reject(res.errMsg);
          return
        }else{
          const data=res.data as string;
          const json= JSON.parse(data);
          resolve(json);
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
}

export default send;
