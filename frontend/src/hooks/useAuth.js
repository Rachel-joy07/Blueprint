import { useState, useEffect } from 'react'

// /.auth/me is served by the Static Web Apps platform itself (not our
// Function app) — it only exists when running through the SWA proxy, i.e.
// the deployed site or `swa start`. Under plain `npm run dev` it 404s,
// which we treat the same as "not signed in" rather than erroring.
export function useAuth() {
  const [user, setUser] = useState(undefined) // undefined = loading

  useEffect(() => {
    fetch('/.auth/me')
      .then((res) => (res.ok ? res.json() : { clientPrincipal: null }))
      .then((data) => setUser(data.clientPrincipal || null))
      .catch(() => setUser(null))
  }, [])

  return user
}
