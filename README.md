# Reproduction for https://github.com/vercel/next.js/issues/98326

## Working scenario ✅

1. Open http://localhost:3000/
2. `callCount` of the data loader will be `1`
3. Click "Revalidate"
4. **Refresh and wait 1 second**
6. Refresh again
7. `callCount` of the data loader will be `2`

## Broken scenario ❌

1. Open http://localhost:3000/
2. `callCount` of the data loader will be `1`
3. Click "Revalidate"
4. **Spam multiple refreshes within the next second**
6. Refresh again
7. `callCount` of the data loader will be **more than `2`**

Check my demo video (there's audio of me explaining the issue):

https://github.com/user-attachments/assets/64e813d8-d4c4-4e02-a046-a1a9465dd9b2
