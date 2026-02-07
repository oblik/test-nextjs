# Next.js 16 excessive rendering issue

1. `npm run build`
1. `npm run start`
1. Open Chrome DevTools
1. Navigate to http://localhost:3000
1. You'll see a bunch of logs "rendering LayoutChild"
1. The logs stop only after seeing "rendering PageChild"
1. If you enable network throttling, the issue gets worse
