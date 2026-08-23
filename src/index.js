import React, { useEffect } from "react";
import ReactDOM from "react-dom";
import Routes from "./routes/index";
import * as serviceWorker from "./serviceWorker";
import { Provider, useDispatch } from "react-redux";
import { store2 } from "service/helpers";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "react-user-onboarding/dist/index.css";
import "./assets/scss/index.scss";
import "bootstrap/dist/css/bootstrap.min.css";
import "react-bootstrap-table-next/dist/react-bootstrap-table2.min.css";
import withClearCache from "./ClearCache";
// import NoInternet from "NoInternet";
import './i18next'; // Initialize i18next
import "./theme/default.css";
import { applyThemeFromLocalStorage } from "theme/applyTheme";
import "./theme/util-classes.css";
import "./theme/app-bg.css";
import "./theme/notifications.css";
import "./theme/accessibility.css";
import { getCompanyConfig } from "action/CompanyAct";
import { setupChunkLoadRecovery } from "utilities/cacheRefresh";

setupChunkLoadRecovery();

const ClearCacheComponent = withClearCache(MainApp);
const queryClient = new QueryClient();

function LoadCompanyConfigOnReload() {
  const dispatch = useDispatch();
  useEffect(() => {
    const user = localStorage.getItem("user");
    const companyIdRaw = localStorage.getItem("companyId");
    if (user && companyIdRaw) {
      try {
        const companyId = JSON.parse(companyIdRaw);
        if (companyId != null) {
          dispatch(getCompanyConfig(companyId)).catch(() => { });
        }
      } catch (e) {
        // ignore
      }
    }
  }, [dispatch]);
  return null;
}

function App() {
  return (
    <>
      <LoadCompanyConfigOnReload />
      <ClearCacheComponent />
    </>
  );
}

function MainApp() {
  try {
    const companyId =
      localStorage.getItem("companyId") !== null
        ? JSON.parse(localStorage.getItem("companyId"))
        : null;
    applyThemeFromLocalStorage(companyId);
  } catch (e) {
    // ignore
  }
  return (<Routes />)
}
ReactDOM.render(
  <Provider store={store2}>
    <QueryClientProvider client={queryClient}>
      {/*<ReactQueryDevtools initialIsOpen={false} />*/}
      <App />
    </QueryClientProvider>
  </Provider>,
  document.getElementById("root"),
);

serviceWorker.register({
  onUpdate: (registration) => {
    if (registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  },
});
