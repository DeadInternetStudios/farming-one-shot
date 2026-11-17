// Look at the weather and the seasonal specks: rain, a storm, snow, petals, leaves and fireflies.
export default async ({ lh, wait, shot }) => {
  await lh('setMinute', 11 * 60);
  await lh('teleport', 20, 14, 'down');
  await wait(600);
  await shot('a1-spring-petals');
  await lh('weather', 'rain');
  await wait(1500);
  await shot('a2-rain');
  await lh('weather', 'storm');
  await lh('setMinute', 15 * 60);
  await wait(2200);
  await shot('a3-storm');
  await lh('setDay', 24);
  await lh('weather', 'snow');
  await lh('setMinute', 11 * 60);
  await wait(1500);
  await shot('a4-snow');
  await lh('setDay', 17);
  await lh('weather', 'sun');
  await wait(1500);
  await shot('a5-fall-leaves');
  await lh('setDay', 10);
  await lh('setMinute', 21 * 60 + 30);
  await wait(1500);
  await shot('a6-summer-night-fireflies');
  console.log('[probe] motes', JSON.stringify(await lh('ambient')), (await lh('state')).weather);
};

export const after = null;
