import React, { useState, useEffect } from "react";
import packageJson from "../package.json";
import { clearCachesAndReload } from "utilities/cacheRefresh";

function withClearCache(Component) {
  function ClearCacheComponent(props) {
    const [isLatestBuildDate, setIsLatestBuildDate] = useState(true);

    useEffect(() => {
      fetch(`/meta.json?${Date.now()}`, { cache: "no-store" })
        .then((response) => response.json())
        .then((meta) => {
          const latestVersionDate = Number(meta.buildDate);
          const currentVersionDate = Number(packageJson.buildDate);

          if (
            Number.isFinite(latestVersionDate) &&
            Number.isFinite(currentVersionDate) &&
            latestVersionDate > currentVersionDate
          ) {
            setIsLatestBuildDate(false);
            clearCachesAndReload();
          } else {
            setIsLatestBuildDate(true);
          }
        })
        .catch(() => {
          setIsLatestBuildDate(true);
        });
    }, []);

    return (
      <React.Fragment>
        {isLatestBuildDate ? <Component {...props} /> : null}
      </React.Fragment>
    );
  }

  return ClearCacheComponent;
}

export default withClearCache;
