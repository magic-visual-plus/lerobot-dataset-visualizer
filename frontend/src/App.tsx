import { Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";

import HomePage from "./pages/HomePage";

const ExplorePage = lazy(() => import("./pages/ExplorePage"));
const DatasetPage = lazy(() => import("./pages/DatasetPage"));
const EpisodePage = lazy(() => import("./pages/EpisodePage"));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/explore"
        element={
          <Suspense fallback={null}>
            <ExplorePage />
          </Suspense>
        }
      />
      <Route
        path="/:org/:dataset"
        element={
          <Suspense fallback={null}>
            <DatasetPage />
          </Suspense>
        }
      />
      <Route
        path="/:org/:dataset/:episode"
        element={
          <Suspense fallback={null}>
            <EpisodePage />
          </Suspense>
        }
      />
    </Routes>
  );
}
