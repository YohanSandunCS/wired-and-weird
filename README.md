# Team Wired & Weird
This project is for a one day robotics competetion, where teams compete to build a autonomous robot which navigates hospital corridors.

# Email from organizing committee
This isn’t just another tech event — it’s a full-on robotics + software fusion challenge, where your team transforms a simple car kit into a mini autonomous hospital runner capable of navigating corridors, reading signs, interpreting camera input, and responding like a real medical delivery assistant.

The competition is structured into four progressive stages, each advancing the story of a hospital delivery robot as it evolves from a basic prototype into a fully intelligent medical supply assistant operating in a realistic hospital-like environment.

---

1st Stage

Your robot is born — you’ll assemble the car, bring the hardware online, and set up the software side with user login and enrollment to form a proper hospital-ready control console. Team members might have to work in parallel on separate tasks while pair-programming to get the best out during the limited time.

---

2nd Stage

Your robot begins navigating “hospital corridors,” where line following, stable turning, and the Next.js control console work together, allowing you to switch between tele-driving and autonomous driving.

---

3rd Stage

The robot becomes smarter — understanding hospital zones, interpreting signs, responding to directions, and behaving with intelligence inside the simulated hospital space. This is where your system starts feeling real.

---

4th Stage

Opens the door for pure creativity: an open innovation round where teams extend the system with advanced ideas, futuristic capabilities, or meaningful medical-domain improvements.

---

Each of these stages runs on two tightly connected tracks: the Robotics Track, led by the Pilot and sub-team, where the physical build, sensors, motors, and autonomous behaviors evolve; and the Software Track, led by the Co-Pilot and sub-team, where the Next.js console, streaming, AI interactions, mission control, and robot communication come to life. Both tracks must move in harmony for your robot to succeed.

As the stages progress, so does the complexity. Success will rely not just on technical skill, but on your team’s ability to work together, with a clear strategy, move quickly, and stay aligned under tight time pressure and most importantly, the ability to utilize AI optimally. That’s where the Innovation Lead becomes essential — guiding strategy, keeping the team focused on high-impact work, and shaping the vision for your final innovation from the very beginning.

Get ready to build, code, design, debug, and innovate — all in one unforgettable day.

---

What the Challenge Will Feel Like

This will be a fast, hands-on, high-energy hackathon, where you will:

✨ Build your robot
✨ Create a Next.js control console
✨ Stream real-time visuals
✨ Switch between manual & autonomous modes
✨ Read hospital signs and respond
✨ And finally — push your creativity with an innovation challenge that extends the system into real medical use cases

# Available Devices/Sensors
- Raspberry Pi 4 Model B
- L298N motor driver
- DC Motors + Robot Chassis
- IR Line Following Sensor Array (5 IR sensors, proximity sensor and a bump sensor)
- Raspberry Pi Camera Module
- Buzzer

# What robot will do but not limited to
- Auto/Manual drive modes
- Stable line following in auto mode
- Recovery when line is lost
- Obstacle avoidance
- Sign detection

# Architecture
- Robot code lives in "device" directory
- There is a centralized gateway python server (gateway directory)
- Robot connects to it using websockets and registers it self with server
- Next.js frontend (frontend directory) app also connects to the server as well using web sockets
- Both robot and app communicates with server constantly using websockets
- Centralized server is just a broker/gateway for these two to talk to eachother
- Next.js app sends control commands and receive live cam feed and telemetry from robot via server
- Robot send live cam feed and telemetry data and receive commands from next.js app via server
