# Math Rush 3D

## Project Overview
Math Rush 3D is a mobile-first 3D crowd runner inspired by Count Masters, but built around mathematics.

### Tech Stack
- React
- Vite
- TypeScript
- Tailwind CSS
- Three.js
- React Three Fiber
- Drei
- Zustand

## Core Gameplay
- Start with 1 character.
- Auto-run forward.
- Move left/right.
- Exactly 10 math gate pairs.
- Choose one gate from each pair.
- Gate answer is added to the crowd.

## Level Flow
Start → 10 Gate Pairs → Obstacles → Boss → Finish Line

## Boss
Track:
- startingCrowd
- actualMathGain
- maxPossibleMathGain
- currentCrowd

Boss must always be beatable if the player consistently chooses the best gates.

## Stars
3★: >=10% remaining crowd
2★: >=5%
1★: Win below 5%

## Audio
Separate sounds for gates, obstacles, boss, win, lose and UI.

## Rules
- Mobile-first.
- Keep architecture modular.
- Don't rewrite working systems.
- Prioritize performance.
