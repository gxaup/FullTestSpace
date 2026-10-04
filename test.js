const s = {
  busNumber: "123", driverName: "John",
  violations: [
    { type: "Standing in motion", timestamp: "12:00 PM", sortMinutes: 720, hasVideo: true, standingAction: "taken", actionDescription: "told to sit" },
    { type: "Standing in motion", timestamp: "12:05 PM", sortMinutes: 725, hasVideo: true, standingAction: "taken", actionDescription: "told to sit again" }
  ]
};

function formatReportTime(t) { return t; }

let r = '';
const videoViolations = s.violations.filter(v => v.hasVideo);
if (videoViolations.length > 0) {
  r += `\n\nCOPYABLES:\n`;
  r += `----------\n`;
  const vGroups = {};
  [...videoViolations].sort((a,b) => a.sortMinutes - b.sortMinutes).forEach(v => {
    if (!vGroups[v.type]) vGroups[v.type] = [];
    vGroups[v.type].push(v);
  });
  Object.keys(vGroups).forEach(type => {
    const times = vGroups[type].map(v => {
      let extra = '';
      if (v.standingAction === 'taken') {
        extra = v.actionDescription ? ` (${v.actionDescription})` : ``;
      } else if (v.notes) {
        extra = ` (${v.notes})`;
      }
      return `${formatReportTime(v.timestamp)}${extra}`;
    });
    r += `[${times.join(', ')}] || ${type} // Bus: ${s.busNumber}, Bus Driver: ${s.driverName}\n`;
  });
}
console.log(r);
