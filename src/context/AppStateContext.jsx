import React, { createContext, useContext, useReducer } from 'react'

const AppStateContext = createContext()

const initialState = {
  sidebarOpen: false,
  activeModal: null
}

function reducer(state,action){
  switch(action.type){
    case 'TOGGLE_SIDEBAR':
      return {...state,sidebarOpen:!state.sidebarOpen}
    case 'OPEN_SIDEBAR':
      return {...state,sidebarOpen:true}
    case 'CLOSE_SIDEBAR':
      return {...state,sidebarOpen:false}
    case 'OPEN_MODAL':
      return {...state,activeModal:action.payload}
    case 'CLOSE_MODAL':
      return {...state,activeModal:null}
    default:
      return state
  }
}

export function AppStateProvider({children}){
  const [state,dispatch] = useReducer(reducer,initialState)
  return <AppStateContext.Provider value={{state,dispatch}}>{children}</AppStateContext.Provider>
}

export const useAppState = ()=> useContext(AppStateContext)
