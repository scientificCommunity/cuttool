import { useEffect, useState } from "react";
import BackgroundReplaceToolPage from "./pages/BackgroundReplaceToolPage.jsx";
import CutoutToolPage from "./pages/CutoutToolPage.jsx";
import ImageSplitToolPage from "./pages/ImageSplitToolPage.jsx";
import ToolsHomePage from "./pages/ToolsHomePage.jsx";

const HOME_HASH = "#/";
const CUTOUT_HASH = "#/tools/cutout";
const BACKGROUND_REPLACE_HASH = "#/tools/background-replace";
const IMAGE_SPLIT_HASH = "#/tools/image-split";

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

  if (
    normalized === "/tools/background-replace" ||
    normalized === "tools/background-replace" ||
    normalized === "/background-replace" ||
    normalized === "/tools/background"
  ) {
    return "backgroundReplace";
  }

  if (
    normalized === "/tools/image-split" ||
    normalized === "tools/image-split" ||
    normalized === "/image-split" ||
    normalized === "/tools/split"
  ) {
    return "imageSplit";
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
    if (route === "cutout") {
      document.title = "抠图 | 工具集";
      return;
    }

    if (route === "backgroundReplace") {
      document.title = "背景替换 | 工具集";
      return;
    }

    if (route === "imageSplit") {
      document.title = "图片拆分 | 工具集";
      return;
    }

    document.title = "工具集";
  }, [route]);

  if (route === "cutout") {
    return <CutoutToolPage homeHref={HOME_HASH} />;
  }

  if (route === "backgroundReplace") {
    return <BackgroundReplaceToolPage homeHref={HOME_HASH} />;
  }

  if (route === "imageSplit") {
    return <ImageSplitToolPage homeHref={HOME_HASH} />;
  }

  return (
    <ToolsHomePage
      cutoutHref={CUTOUT_HASH}
      backgroundReplaceHref={BACKGROUND_REPLACE_HASH}
      imageSplitHref={IMAGE_SPLIT_HASH}
    />
  );
}
