import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { TeamSession, Robot } from '@/types/messages'

interface TeamRobotData {
  robots: Robot[]
  activeRobotId: string | null
}

interface AppState {
  // Team session
  teamSession: TeamSession
  
  // Team-based robot storage
  teamRobots: Record<string, TeamRobotData>
  
  // Current team's data (synced from teamRobots)
  robots: Robot[]
  activeRobotId: string | null
  
  // Helper functions
  _syncCurrentTeamData: () => void
  
  // Actions
  login: (teamCode: string) => void
  logout: () => void
  clearAllRobots: () => void
  addRobot: (robotId: string, name?: string) => boolean
  setActiveRobot: (robotId: string | null) => void
  updateRobotStatus: (robotId: string, isOnline: boolean) => void
  updateRobotBattery: (robotId: string, battery: number) => void
}

const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      teamSession: {
        teamCode: '',
        loggedIn: false,
      },
      teamRobots: {},
      
      // Current team's robots and activeRobotId (computed)
      robots: [],
      activeRobotId: null,

      // Helper to sync current team data
      _syncCurrentTeamData: () => {
        const { teamSession, teamRobots } = get()
        if (!teamSession.loggedIn || !teamSession.teamCode) {
          set({ robots: [], activeRobotId: null })
          return
        }
        const teamData = teamRobots[teamSession.teamCode] || { robots: [], activeRobotId: null }
        set({ robots: teamData.robots, activeRobotId: teamData.activeRobotId })
      },

      // Actions
      login: (teamCode: string) => {
        set({
          teamSession: {
            teamCode,
            loggedIn: true,
          },
        })
        // Sync the team data after login
        const store = get()
        store._syncCurrentTeamData()
      },

      logout: () => {
        set({
          teamSession: {
            teamCode: '',
            loggedIn: false,
          },
        })
        // Clear current team data on logout
        const store = get()
        store._syncCurrentTeamData()
      },

      clearAllRobots: () => {
        const { teamSession } = get()
        if (!teamSession.loggedIn || !teamSession.teamCode) return
        
        set((state) => ({
          teamRobots: {
            ...state.teamRobots,
            [teamSession.teamCode]: {
              robots: [],
              activeRobotId: null,
            },
          },
        }))
        // Sync current team data
        const store = get()
        store._syncCurrentTeamData()
      },

      addRobot: (robotId: string, name?: string) => {
        const { teamSession, teamRobots } = get()
        if (!teamSession.loggedIn || !teamSession.teamCode) return false
        
        const teamCode = teamSession.teamCode
        const currentTeamData = teamRobots[teamCode] || { robots: [], activeRobotId: null }
        
        // Check if robot already exists for this team
        if (currentTeamData.robots.some(robot => robot.robotId === robotId)) {
          return false // Robot already exists
        }

        const newRobot: Robot = {
          robotId,
          name,
          isOnline: false,
        }

        set((state) => ({
          teamRobots: {
            ...state.teamRobots,
            [teamCode]: {
              ...currentTeamData,
              robots: [...currentTeamData.robots, newRobot],
            },
          },
        }))

        // Sync current team data
        const store = get()
        store._syncCurrentTeamData()

        return true // Successfully added
      },

      setActiveRobot: (robotId: string | null) => {
        const { teamSession, teamRobots } = get()
        if (!teamSession.loggedIn || !teamSession.teamCode) return
        
        const teamCode = teamSession.teamCode
        const currentTeamData = teamRobots[teamCode] || { robots: [], activeRobotId: null }
        
        set((state) => ({
          teamRobots: {
            ...state.teamRobots,
            [teamCode]: {
              ...currentTeamData,
              activeRobotId: robotId,
            },
          },
        }))
        
        // Sync current team data
        const store = get()
        store._syncCurrentTeamData()
      },

      updateRobotStatus: (robotId: string, isOnline: boolean) => {
        const { teamSession, teamRobots } = get()
        if (!teamSession.loggedIn || !teamSession.teamCode) return
        
        const teamCode = teamSession.teamCode
        const currentTeamData = teamRobots[teamCode] || { robots: [], activeRobotId: null }
        
        set((state) => ({
          teamRobots: {
            ...state.teamRobots,
            [teamCode]: {
              ...currentTeamData,
              robots: currentTeamData.robots.map(robot =>
                robot.robotId === robotId
                  ? { ...robot, isOnline }
                  : robot
              ),
            },
          },
        }))
        
        // Sync current team data
        const store = get()
        store._syncCurrentTeamData()
      },

      updateRobotBattery: (robotId: string, battery: number) => {
        const { teamSession, teamRobots } = get()
        if (!teamSession.loggedIn || !teamSession.teamCode) return
        
        const teamCode = teamSession.teamCode
        const currentTeamData = teamRobots[teamCode] || { robots: [], activeRobotId: null }
        
        set((state) => ({
          teamRobots: {
            ...state.teamRobots,
            [teamCode]: {
              ...currentTeamData,
              robots: currentTeamData.robots.map(robot =>
                robot.robotId === robotId
                  ? { ...robot, battery, lastTelemetryUpdate: Date.now() }
                  : robot
              ),
            },
          },
        }))
        
        // Sync current team data
        const store = get()
        store._syncCurrentTeamData()
      },
    }),
    {
      name: 'medi-runner-store',
      partialize: (state) => ({
        teamSession: state.teamSession,
        teamRobots: state.teamRobots,
      }),
    }
  )
)

export default useAppStore