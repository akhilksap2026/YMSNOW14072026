import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type TabletOrientation = "landscape" | "portrait";

interface TabletViewContextValue {
  tabletMode: boolean;
  orientation: TabletOrientation;
  toggleTablet: () => void;
  toggleOrientation: () => void;
  setTabletMode: (v: boolean) => void;
}

const TabletViewContext = createContext<TabletViewContextValue>({
  tabletMode: false,
  orientation: "landscape",
  toggleTablet: () => {},
  toggleOrientation: () => {},
  setTabletMode: () => {},
});

export function TabletViewProvider({ children }: { children: ReactNode }) {
  const [tabletMode, setTabletMode] = useState(() =>
    localStorage.getItem("ymsnow_tablet_mode") === "true"
  );
  const [orientation, setOrientation] = useState<TabletOrientation>(() =>
    (localStorage.getItem("ymsnow_tablet_orientation") as TabletOrientation) || "landscape"
  );

  useEffect(() => {
    localStorage.setItem("ymsnow_tablet_mode", String(tabletMode));
  }, [tabletMode]);

  useEffect(() => {
    localStorage.setItem("ymsnow_tablet_orientation", orientation);
  }, [orientation]);

  const toggleTablet = () => setTabletMode((v) => !v);
  const toggleOrientation = () =>
    setOrientation((o) => (o === "landscape" ? "portrait" : "landscape"));

  return (
    <TabletViewContext.Provider value={{ tabletMode, orientation, toggleTablet, toggleOrientation, setTabletMode }}>
      {children}
    </TabletViewContext.Provider>
  );
}

export function useTabletView() {
  return useContext(TabletViewContext);
}
