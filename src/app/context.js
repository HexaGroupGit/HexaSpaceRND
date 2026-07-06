import { createContext, useContext } from 'react'

// App-wide context: { data, refresh, patch, signOut } — provided by MobileApp.
export const AppCtx = createContext(null)
export const useApp = () => useContext(AppCtx)
