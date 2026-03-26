import { useEffect, useState } from "react";
import CutoutToolPage from "./pages/CutoutToolPage.jsx";
import ToolsHomePage from "./pages/ToolsHomePage.jsx";

const HOME_HASH = "#/";
const CUTOUT_HASH = "#/tools/cutout";

function readRouteFromHash() {
  if (typeof window === "undefined") {
    return "home";
  }

  const rawHash = window.location.hash.replace(/^#/, "");
  const normalized = rawHash === "" ? "/" : rawHash.replace(/\/+$/, "") || "/";

  if (normalized === "/" || normalized === "") {
    return "home";
  }

  if (normalized === "/tools/cutout" || normalized === "tools/cutout" || normalized === "/cutout") {
    return "cutout";
  }

  return "home";
}

export default function App() {
  const [route, setRoute] = useState(() => readRouteFromHash());

  useEffect(() => {
    const syncRoute = () => setRoute(readRouteFromHash());

    window.addEventListener("hashchange", syncRoute);
    syncRoute();

    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  useEffect(() => {
    document.title = route === "cutout" ? "抠图 | 工具集" : "工具集";
  }, [route]);

  if (route === "cutout") {
    return <CutoutToolPage homeHref={HOME_HASH} />;
  }

  return <ToolsHomePage cutoutHref={CUTOUT_HASH} />;
}
