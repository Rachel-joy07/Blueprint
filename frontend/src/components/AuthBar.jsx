export default function AuthBar({ user }) {
  if (user === undefined) {
    return <div className="h-4" /> // reserve space, avoid a flash of the wrong state
  }
  return (
    <div className="flex items-center gap-3 text-[13px]">
      {user ? (
        <>
          <span className="flex items-center gap-2 text-blueprint-line/55">
            <span className="w-5 h-5 rounded-full bg-accent/15 text-accent text-[10px] font-semibold flex items-center justify-center">
              {user.userDetails?.[0]?.toUpperCase() || '•'}
            </span>
            {user.userDetails}
          </span>
          <a
            href="/.auth/logout"
            className="text-blueprint-line/45 hover:text-blueprint-line transition-colors"
          >
            Sign out
          </a>
        </>
      ) : (
        <a
          href="/.auth/login/github?post_login_redirect_uri=/"
          className="inline-flex items-center gap-1.5 text-accent hover:text-accent/80 font-medium transition-colors"
        >
          Sign in to save scan history
        </a>
      )}
    </div>
  )
}
