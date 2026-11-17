/* NOVAFit · yoga sessions
   Which yoga sessions there are, how long each step lasts at a chosen length,
   and which one to suggest right now. Pure functions without any DOM access,
   so they run in the browser (window.NFYoga) and in Node for tests/yoga.test.js.
   Pose keys (pose:"lunge", "lunge-" = mirrored) are drawn by poseSvg in index.html. */
(function (root) {
  "use strict";

  const MIN_STEP = 15;   // seconds: no step gets shorter than this when a session is shortened

  // Final exams at Nova SBE, fall semester 2026 (both days included).
  // During these days the app suggests the study break between 9:00 and 20:00.
  const EXAM_WEEKS = [["2026-12-07", "2026-12-21"]];

  /* where: what you need (chair, mat, floor) · level: 1 calm, 2 medium, 3 strong
     lens: lengths in minutes to choose from, the first one is the default
     steps: n name, s Sanskrit or short detail, i instruction, d seconds at the default length */
  const SESSIONS = [
    { id: "study", n: "Study break", desc: "Neck, shoulders, breathing. Right at your desk.", where: "Chair", level: 1, lens: [5, 10], steps: [
      { n: "Arrive", s: "Sit tall", i: "Feet flat on the floor, hands on your thighs. Close your eyes and take three slow breaths.", d: 30, pose: "cseat" },
      { n: "Shoulder rolls", s: "Loosen up", i: "Pull your shoulders up to your ears, then roll them back and down. Slow and big.", d: 30, pose: "cseat" },
      { n: "Neck stretch right", s: "Ear to shoulder", i: "Right hand on your head, let your right ear sink toward the shoulder. Left shoulder stays low.", d: 30, pose: "cneck" },
      { n: "Neck stretch left", s: "Ear to shoulder", i: "Left hand on your head, left ear toward the left shoulder. Breathe into the right side of your neck.", d: 30, pose: "cneck-" },
      { n: "Side reach left", s: "Long side", i: "Right arm up and over to the left. Both sit bones stay on the chair.", d: 30, pose: "cside" },
      { n: "Side reach right", s: "Long side", i: "Left arm up and over to the right. Breathe into your ribs.", d: 30, pose: "cside-" },
      { n: "Arms up", s: "Long spine", i: "Interlace your fingers, palms to the ceiling. Grow tall, shoulders away from your ears.", d: 30, pose: "creach" },
      { n: "Standing forward fold", s: "Uttanasana", i: "Stand up, soft knees, let your upper body hang. Nod your head yes and no.", d: 45, pose: "fold" },
      { n: "Box breathing", s: "4 · 4 · 4 · 4", i: "Sit down again. Breathe in for 4, hold for 4, out for 4, hold for 4. Then back to the books.", d: 45, pose: "cseat" }
    ] },
    { id: "winddown", n: "Wind down", desc: "Long, quiet holds on the floor. Good before sleep.", where: "Floor", level: 1, lens: [15, 10, 20], steps: [
      { n: "Child's Pose", s: "Balasana", i: "Knees wide, hips to your heels, forehead down. Let your breath get slower.", d: 120, pose: "child" },
      { n: "Low Lunge right", s: "Dragon", i: "Right foot forward, back knee down. Let your hips sink and stay soft.", d: 90, pose: "lunge" },
      { n: "Low Lunge left", s: "Dragon", i: "Left foot forward, back knee down. Breathe into the front of the back hip.", d: 90, pose: "lunge-" },
      { n: "Butterfly", s: "Baddha Konasana", i: "Soles together, knees drop outward. Fold forward and let your head hang.", d: 120, pose: "butterfly" },
      { n: "Seated Forward Fold", s: "Paschimottanasana", i: "Legs long, knees may bend. Fold forward and rest, no pulling.", d: 90, pose: "paschim" },
      { n: "Supine Twist right", s: "Supta Matsyendrasana", i: "On your back, knees fall to the left, gaze to the right.", d: 60, pose: "twist" },
      { n: "Supine Twist left", s: "Supta Matsyendrasana", i: "Knees fall to the right, gaze to the left.", d: 60, pose: "twist-" },
      { n: "Legs up the wall", s: "Viparita Karani", i: "Hips close to a wall, legs resting up on it, arms open. Stay here and breathe.", d: 180, pose: "legsup" },
      { n: "Final Relaxation", s: "Savasana", i: "Lie long, eyes closed. Nothing left to do today. Good night.", d: 180, pose: "sava" }
    ] },
    { id: "basics", n: "Beginner basics", desc: "Slow, no chaturangas, every pose explained.", where: "Mat", level: 1, lens: [20, 15, 30], steps: [
      { n: "Arrive", s: "Sukhasana", i: "Sit cross-legged, on a cushion if your knees are high. Breathe in and out through your nose.", d: 90, pose: "seat" },
      { n: "Cat-Cow", s: "Marjaryasana-Bitilasana", i: "Hands under shoulders, knees under hips. Inhale: belly drops. Exhale: round your back.", d: 90, pose: "cat" },
      { n: "Child's Pose", s: "Balasana", i: "Sit back on your heels, arms long, forehead down. You can come back here any time.", d: 60, pose: "child" },
      { n: "Downward Dog", s: "Adho Mukha Svanasana", i: "Lift your hips up and back. Bend your knees as much as you like, a long back matters more than straight legs.", d: 45, pose: "dog" },
      { n: "Low Lunge right", s: "Anjaneyasana", i: "Right foot between your hands, left knee down. Hands on the front knee, hips sink forward.", d: 60, pose: "lunge" },
      { n: "Low Lunge left", s: "Anjaneyasana", i: "Left foot forward, right knee down. Keep the front knee above the ankle.", d: 60, pose: "lunge-" },
      { n: "Warrior II right", s: "Virabhadrasana II", i: "Wide stance, right toes forward, left foot turned in. Bend the right knee, arms long.", d: 45, pose: "w2" },
      { n: "Warrior II left", s: "Virabhadrasana II", i: "Turn around: left toes forward, bend the left knee. Shoulders stay relaxed.", d: 45, pose: "w2-" },
      { n: "Tree right", s: "Vrksasana", i: "Stand on your left leg, right foot on the ankle or calf, never on the knee. Use a wall if you wobble.", d: 40, pose: "tree" },
      { n: "Tree left", s: "Vrksasana", i: "Stand on your right leg. Look at one fixed point.", d: 40, pose: "tree-" },
      { n: "Bridge", s: "Setu Bandhasana", i: "On your back, feet hip-width. Lift your hips slowly, roll down slowly. 4 to 5 times.", d: 60, pose: "bridge" },
      { n: "Supine Twist right", s: "Supta Matsyendrasana", i: "Knees to the left, right arm long. Both shoulders stay heavy.", d: 45, pose: "twist" },
      { n: "Supine Twist left", s: "Supta Matsyendrasana", i: "Knees to the right, left arm long.", d: 45, pose: "twist-" },
      { n: "Final Relaxation", s: "Savasana", i: "Lie long on your back, palms up, eyes closed. Well done for showing up.", d: 180, pose: "sava" }
    ] },
    { id: "morning", n: "Morning wake-up", desc: "Gentle Sun Salutations to start the day.", where: "Mat", level: 2, lens: [10, 15], steps: [
      { n: "Arrive", s: "Sukhasana", i: "Sit tall, three deep breaths. Notice how you feel this morning.", d: 60, pose: "seat" },
      { n: "Cat-Cow", s: "Marjaryasana-Bitilasana", i: "Move slowly with your breath, wake up your spine.", d: 60, pose: "cat" },
      { n: "Downward Dog", s: "Adho Mukha Svanasana", i: "Pedal your feet, bend one knee, then the other.", d: 60, pose: "dog" },
      { n: "Sun Salutation A, 2 rounds", s: "Surya Namaskar A", i: "Arms up, forward fold, half lift, plank, lower down, cobra, downward dog. One breath per movement.", d: 120, pose: "up" },
      { n: "Chair", s: "Utkatasana", i: "Sit back as if on a chair, arms up. Weight in your heels.", d: 45, pose: "chair" },
      { n: "Warrior I right", s: "Virabhadrasana I", i: "Right foot forward, knee bent, hips facing forward, arms up.", d: 45, pose: "w1" },
      { n: "Warrior I left", s: "Virabhadrasana I", i: "Left foot forward, knee bent, arms up.", d: 45, pose: "w1-" },
      { n: "Tree right", s: "Vrksasana", i: "Stand on your left leg, hands in front of your chest.", d: 45, pose: "tree" },
      { n: "Tree left", s: "Vrksasana", i: "Stand on your right leg.", d: 45, pose: "tree-" },
      { n: "Standing Forward Fold", s: "Uttanasana", i: "Soft knees, let your head hang heavy.", d: 30, pose: "fold" },
      { n: "Arms up", s: "Urdhva Hastasana", i: "Roll up slowly, reach your arms up and take one big breath. Have a good day.", d: 45, pose: "up" }
    ] },
    { id: "afterrun", n: "After your run", desc: "Calves, hamstrings and hip flexors.", where: "Mat", level: 2, lens: [15, 10, 20], steps: [
      { n: "Downward Dog", s: "Adho Mukha Svanasana", i: "Press one heel down, then the other. This is for your calves.", d: 60, pose: "dog" },
      { n: "Low Lunge right", s: "Anjaneyasana", i: "Right foot forward, left knee down, hips forward. Stretches the left hip flexor.", d: 60, pose: "lunge" },
      { n: "Lizard right", s: "Utthan Pristhasana", i: "Hands inside your right foot, hips low.", d: 60, pose: "lizard" },
      { n: "Low Lunge left", s: "Anjaneyasana", i: "Left foot forward, right knee down, hips forward.", d: 60, pose: "lunge-" },
      { n: "Lizard left", s: "Utthan Pristhasana", i: "Hands inside your left foot, breathe into your hips.", d: 60, pose: "lizard-" },
      { n: "Pigeon right", s: "Eka Pada Rajakapotasana", i: "Right knee forward, left leg long behind you. Good for the glutes after a run.", d: 90, pose: "pigeon" },
      { n: "Pigeon left", s: "Eka Pada Rajakapotasana", i: "Left knee forward, right leg long behind you.", d: 90, pose: "pigeon-" },
      { n: "Seated Forward Fold", s: "Paschimottanasana", i: "Legs long, fold forward with a long back. Hamstrings.", d: 90, pose: "paschim" },
      { n: "Butterfly", s: "Baddha Konasana", i: "Soles together, knees drop outward.", d: 60, pose: "butterfly" },
      { n: "Supine Twist right", s: "Supta Matsyendrasana", i: "Knees to the left, gaze to the right.", d: 45, pose: "twist" },
      { n: "Supine Twist left", s: "Supta Matsyendrasana", i: "Knees to the right, gaze to the left.", d: 45, pose: "twist-" },
      { n: "Final Relaxation", s: "Savasana", i: "Lie long and let your legs go heavy. Nice run.", d: 120, pose: "sava" }
    ] },
    { id: "back", n: "Back and neck", desc: "For long days at the laptop.", where: "Mat", level: 1, lens: [12, 20], steps: [
      { n: "Arrive", s: "Sukhasana", i: "Sit tall, roll your shoulders back and down a few times.", d: 60, pose: "seat" },
      { n: "Cat-Cow", s: "Marjaryasana-Bitilasana", i: "Slow and big: round your whole back, then let the belly drop.", d: 90, pose: "cat" },
      { n: "Child's Pose", s: "Balasana", i: "Walk your hands to the right, then to the left, for the sides of your back.", d: 60, pose: "child" },
      { n: "Cobra", s: "Bhujangasana", i: "On your belly, lift your chest gently, elbows close. Opens what sitting closes.", d: 30, pose: "cobra" },
      { n: "Child's Pose", s: "Balasana", i: "Back to rest for a few breaths.", d: 45, pose: "child" },
      { n: "Bridge", s: "Setu Bandhasana", i: "Roll up one vertebra at a time and roll down the same way. 4 to 5 times.", d: 60, pose: "bridge" },
      { n: "Supine Twist right", s: "Supta Matsyendrasana", i: "Knees to the left, right arm long, gaze to the right.", d: 45, pose: "twist" },
      { n: "Supine Twist left", s: "Supta Matsyendrasana", i: "Knees to the right, left arm long.", d: 45, pose: "twist-" },
      { n: "Happy Baby", s: "Ananda Balasana", i: "Hands on your feet, rock gently. Massages the lower back.", d: 45, pose: "baby" },
      { n: "Final Relaxation", s: "Savasana", i: "Lie long, let your shoulders melt into the floor.", d: 120, pose: "sava" }
    ] },
    { id: "vinyasa", n: "Vinyasa flow", desc: "Flowing and sweaty. A different flow every time.", where: "Mat", level: 3, lens: [30, 15, 45], steps: null }
  ];

  /* Sun Salutations, one step per breath. Shown instead of one long "Sun Salutation A, 3 rounds" step,
     so the picture and the voice can say what comes next. fix: never stretched or shortened. */
  const SUN = {
    A: [["Arms up", "in", 5, "up"], ["Forward fold", "out", 5, "fold"], ["Half lift, long back", "in", 5, "half"],
        ["Plank", "out", 5, "plank"], ["Lower down, knees may touch", "out", 5, "low"], ["Cobra", "in", 5, "cobra"],
        ["Downward dog, 5 breaths", "out", 25, "dog"], ["Step forward, half lift", "in", 5, "half"], ["Forward fold", "out", 5, "fold"]],
    B: [["Chair", "in", 5, "chair"], ["Forward fold", "out", 5, "fold"], ["Half lift, long back", "in", 5, "half"],
        ["Plank", "out", 5, "plank"], ["Lower down", "out", 5, "low"], ["Cobra", "in", 5, "cobra"], ["Downward dog", "out", 10, "dog"],
        ["Warrior I, right foot forward", "in", 15, "w1"], ["Plank · lower down · cobra", "out", 10, "plank"], ["Downward dog", "out", 5, "dog"],
        ["Warrior I, left foot forward", "in", 15, "w1-"], ["Plank · lower down · cobra", "out", 10, "plank"], ["Downward dog, 5 breaths", "out", 25, "dog"],
        ["Step forward, fold", "out", 5, "fold"]]
  };
  const BREATH = { in: "Inhale", out: "Exhale" };

  /* Replaces every "Sun Salutation A/B, N rounds" step with its rounds, one step per breath. */
  function expandSun(steps) {
    const out = [];
    for (const x of steps || []) {
      const m = /Sun Salutation ([AB]),\s*(\d+) rounds?/.exec(x.n || "");
      if (!m) { out.push(x); continue; }
      const kind = m[1], rounds = Math.max(1, Number(m[2]));
      for (let r = 1; r <= rounds; r++) {
        SUN[kind].forEach(([n, b, d, pose]) => out.push({ n, s: `Sun Salutation ${kind} · round ${r} of ${rounds} · ${BREATH[b]}`,
          i: d > 10 ? "Stay here and breathe slowly. Heels toward the floor, hips up and back." : b === "in" ? "Move as you breathe in." : "Move as you breathe out.",
          d, pose, breath: b, fix: true }));
        out.push({ n: r < rounds ? "Rise up, arms up" : "Rise up, hands to your heart", s: `Sun Salutation ${kind} · Inhale`,
          i: r < rounds ? "Inhale all the way up. Next round starts with your exhale." : "Stand tall for a breath.", d: 5, pose: "up", breath: "in", fix: true });
      }
    }
    return out;
  }

  const byId = id => SESSIONS.find(s => s.id === id) || null;
  const total = steps => (steps || []).reduce((a, x) => a + x.d, 0);
  const minutes = steps => Math.round(total(steps) / 60);

  /* Is len one of the lengths this session offers? Otherwise its default. */
  function lengthFor(id, len) {
    const s = byId(id); if (!s) return 0;
    return s.lens.includes(Number(len)) ? Number(len) : s.lens[0];
  }

  /* The steps of a session at a length in minutes: every hold grows or shrinks by the same factor,
     rounded to 5 s and never below 15 s. "2 rounds" in a name changes with it. */
  function stepsFor(id, len) {
    const s = byId(id); if (!s || !s.steps) return [];
    const L = lengthFor(id, len), k = (L * 60) / total(s.steps);
    return expandSun(s.steps.map(x => Object.assign({}, x, {
      d: Math.max(MIN_STEP, Math.round(x.d * k / 5) * 5),
      n: Math.abs(k - 1) < .05 ? x.n : x.n.replace(/(\d+) rounds/, (m, r) => { const n = Math.max(1, Math.round(r * k)); return n + (n === 1 ? " round" : " rounds"); })
    })));
  }

  const ymd = t => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  function examWeek(t, weeks) {
    const day = ymd(t);
    return (weeks || EXAM_WEEKS).some(([a, b]) => day >= a && day <= b);
  }

  /* Which session fits right now? now: time, ranToday: logged a run today. "" = no suggestion. */
  function suggest(now, ranToday, weeks) {
    const h = new Date(now).getHours();
    if (h >= 21 || h < 4) return "winddown";
    if (ranToday) return "afterrun";
    if (h >= 4 && h < 10) return "morning";
    if (examWeek(now, weeks) && h >= 9 && h < 20) return "study";
    return "";
  }

  const api = { SESSIONS, EXAM_WEEKS, MIN_STEP, SUN, expandSun, byId, total, minutes, lengthFor, stepsFor, examWeek, suggest };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NFYoga = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
