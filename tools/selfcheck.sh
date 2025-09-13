# save as tools/selfcheck.sh ; then: bash tools/selfcheck.sh
set -euo pipefail
mkdir -p artifacts/{routing,metrics,coverage,env}
echo "Node: $(node -v)" | tee artifacts/env/node.txt
echo "NPM:  $(npm -v)"  | tee -a artifacts/env/node.txt

# نصب حداقلی برای جلوگیری از خطاهای گزارش‌شده
npm pkg set scripts.typecheck="tsc -p tsconfig.json --noEmit" >/dev/null 2>&1 || true
npm pkg set scripts.lint="eslint . --ext .ts,.tsx,.js,.jsx --report-unused-disable-directives" >/dev/null 2>&1 || true
npm pkg set scripts.test="vitest run --reporter=dot --coverage=false" >/dev/null 2>&1 || true

# وابستگی‌های گمشدهٔ متداول
npm i -D @tailwindcss/postcss postcss autoprefixer tailwindcss >/dev/null 2>&1 || true
npm i express-mongo-sanitize >/dev/null 2>&1 || true

# استارت (اگر اسکریپت start داری، همان را بزن)
(node server/index.js || npm run start || true) 2>&1 | tee artifacts/routing/server.log &
SERVER_PID=$!
sleep 2

# سلامت و متریک‌ها
curl -sS http://localhost:3000/health | tee artifacts/routing/health.txt || true
curl -sS http://localhost:3000/metrics | head -n 50 | tee artifacts/metrics/sample.txt || true

# Lint/Typecheck/Test
npm run lint 2>&1 | tee artifacts/coverage/lint.log || true
npm run typecheck 2>&1 | tee artifacts/coverage/typecheck.log || true
npm test 2>&1 | tee artifacts/coverage/test.log || true

# پایان
kill $SERVER_PID >/dev/null 2>&1 || true
echo "DONE. Attach artifacts/ for review."