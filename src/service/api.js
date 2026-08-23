import { axiosInstance, logout } from "./utilities";

export var api = async function ({
  method = "get",
  api,
  body,
  status = false,
  token = "",
  baseURL = "auth",
  params
}) {
  return await new Promise((resolve, reject) => {
    // setting token
    try {
      let authHeader = "";
      const rawUser = window?.localStorage?.getItem
        ? window.localStorage.getItem("user")
        : null;
      if (rawUser) {
        try {
          const parsed = JSON.parse(rawUser);
          if (parsed && parsed.token) {
            authHeader = `Bearer ${parsed.token}`;
          }
        } catch {
          // ignore malformed value
        }
      }
      axiosInstance.defaults.headers.common["Authorization"] = authHeader;
    } catch {
      axiosInstance.defaults.headers.common["Authorization"] = "";
    }

    axiosInstance({
      method,
      url: `${getServiceUrl("production")}${api}`,
      data: body ?? "", // Only for POST/PUT
      params: params ?? {}, // Adds query params
    })
      .then((data) => {
        resolve(statusHelper(status, data));
      })
      .catch((error) => {
        try {
          if (error.response) {
            reject(statusHelper(status, error.response));
          } else {
            reject(error);
          }
        } catch (err) {
          reject(err);
        }
      });
  });
};


var statusHelper = (status, data) => {
  if (data.status === 401 || data.status === 403) {
    logout();
  }
  if (status) {
    return {
      status: data.status,
      ...data.data,
    };
  } else {
    return data.data;
  }
};

export let getServiceUrl = (baseURL) => {
  let finalURL = "";



  

  switch ('production') {
    case "production":
      finalURL = "https://hr.vihanga.io/api/";
      break;
    case "ollaa-company":
      finalURL = "https://hr.vihanga.io/api/";
      break;
    case "local":
      finalURL = "http://localhost:4000/api/";
      break;
    default:
      finalURL = "http://localhost:4000/api/";
      break;
  }
  return finalURL;
};
