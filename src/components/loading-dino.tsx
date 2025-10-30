"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface Obstacle {
    position: number;
    height: number;
    type: 'cactus' | 'bird';
    scored?: boolean;
}

interface Cloud {
    position: number;
    yPosition: number;
    speed: number;
}

export function LoadingDino() {
    const [isJumping, setIsJumping] = useState(false);
    const [isDucking, setIsDucking] = useState(false);
    const [obstacles, setObstacles] = useState<Obstacle[]>([]);
    const [clouds, setClouds] = useState<Cloud[]>([
        { position: 20, yPosition: 20, speed: 0.3 },
        { position: 60, yPosition: 35, speed: 0.2 },
        { position: 90, yPosition: 15, speed: 0.25 }
    ]);
    const [score, setScore] = useState(0);
    const [groundOffset, setGroundOffset] = useState(0);
    const [legFrame, setLegFrame] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [obstacleSpeed, setObstacleSpeed] = useState(1.5);
    const gameContainerRef = useRef<HTMLDivElement>(null);
    const scoreRef = useRef(0);
    const obstacleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Collision detection function
    const checkCollision = useCallback(() => {
        if (!gameContainerRef.current || obstacles.length === 0) return false;

        const containerWidth = gameContainerRef.current.offsetWidth;
        const containerHeight = 256; // h-64 = 256px

        // Dino horizontal position - left-16 means left: 64px (16 * 4 = 64px based on Tailwind spacing)
        const dinoLeftPx = 64;
        const dinoWidth = 50;
        const dinoRightPx = dinoLeftPx + dinoWidth;

        // Dino vertical position
        const dinoBottomFromBottom = isJumping ? 120 : 64;
        const dinoHeight = isDucking ? 35 : 55;
        const dinoTopPx = containerHeight - dinoBottomFromBottom - dinoHeight;
        const dinoBottomPx = containerHeight - dinoBottomFromBottom;

        for (const obstacle of obstacles) {
            // Obstacle uses left percentage (left: X%)
            // position: 100 means at right edge, position: 0 means at left edge
            const obstacleLeftPercent = obstacle.position;
            const obstacleWidth = obstacle.type === 'cactus' ? 30 : 40;
            const obstacleLeftPx = (obstacleLeftPercent / 100) * containerWidth;
            const obstacleRightPx = obstacleLeftPx + obstacleWidth;

            // Obstacle vertical position
            // Cactus: bottom: 64px, Bird: bottom: 100px
            const obstacleBottomFromBottom = obstacle.type === 'bird' ? 100 : 64;
            const obstacleHeight = obstacle.type === 'cactus' ? 48 : 25;
            const obstacleTopPx = containerHeight - obstacleBottomFromBottom - obstacleHeight;
            const obstacleBottomPx = containerHeight - obstacleBottomFromBottom;

            // AABB collision detection: check if bounding boxes overlap
            const horizontalOverlap = dinoRightPx > obstacleLeftPx && dinoLeftPx < obstacleRightPx;
            const verticalOverlap = dinoBottomPx > obstacleTopPx && dinoTopPx < obstacleBottomPx;

            if (horizontalOverlap && verticalOverlap) {
                return true;
            }
        }
        return false;
    }, [obstacles, isJumping, isDucking]);

    const handleJump = useCallback(() => {
        if (!isJumping && !isDucking && !gameOver) {
            setIsJumping(true);
            setTimeout(() => setIsJumping(false), 600);
        }
    }, [isJumping, isDucking, gameOver]);

    const handleDuck = useCallback((duck: boolean) => {
        if (!isJumping && !gameOver) {
            setIsDucking(duck);
        }
    }, [isJumping, gameOver]);

    const resetGame = useCallback(() => {
        setGameOver(false);
        setScore(0);
        scoreRef.current = 0;
        setObstacles([]);
        setObstacleSpeed(1.5);
        setIsJumping(false);
        setIsDucking(false);
    }, []);

    // Handle animation loop
    useEffect(() => {
        if (gameOver) return;

        // Animate obstacles and score
        const interval = setInterval(() => {
            setObstacles((prev) => {
                const updated = prev.map((obs) => {
                    const newObs = {
                        ...obs,
                        position: obs.position - obstacleSpeed,
                    };

                    // Add score when obstacle passes the dino (dino is at left: 64px, which is about 10-15% of screen)
                    // Score when obstacle passes position 15 and hasn't been scored yet
                    if (newObs.position < 15 && !newObs.scored) {
                        newObs.scored = true;
                        scoreRef.current += 1;
                        setScore(scoreRef.current);
                        // Increase speed every 5 points, more gradually
                        if (scoreRef.current % 5 === 0) {
                            setObstacleSpeed((speed) => Math.min(speed + 0.15, 4));
                        }
                    }

                    return newObs;
                }).filter((obs) => obs.position > -10);

                return updated;
            });

            // Animate clouds
            setClouds((prev) =>
                prev.map((cloud) => ({
                    ...cloud,
                    position: cloud.position - cloud.speed,
                })).map((cloud) =>
                    cloud.position < -10 ? { ...cloud, position: 110 } : cloud
                )
            );

            // Animate ground
            setGroundOffset((prev) => (prev + obstacleSpeed * 0.8) % 20);

            // Animate legs
            setLegFrame((prev) => (prev + 1) % 4);

            // Check for collisions
            if (checkCollision()) {
                setGameOver(true);
            }
        }, 50);

        // Handle keyboard
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === "Space" || e.code === "ArrowUp") {
                e.preventDefault();
                if (gameOver) {
                    resetGame();
                } else {
                    handleJump();
                }
            } else if (e.code === "ArrowDown") {
                e.preventDefault();
                handleDuck(true);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === "ArrowDown") {
                e.preventDefault();
                handleDuck(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);

        return () => {
            clearInterval(interval);
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, [handleJump, handleDuck, checkCollision, obstacleSpeed, gameOver, resetGame]);

    // Handle obstacle spawning separately
    useEffect(() => {
        if (gameOver) return;

        const getObstacleInterval = () => {
            const baseInterval = 1200;
            const scoreMultiplier = Math.max(0.7, 1 - (scoreRef.current / 100) * 0.3);
            return baseInterval * scoreMultiplier;
        };

        const addObstacle = () => {
            const random = Math.random();
            const obstacleType: 'cactus' | 'bird' = random > 0.7 ? 'bird' : 'cactus';
            const height = obstacleType === 'bird' ? (random > 0.8 ? 20 : 14) : 12;

            setObstacles((prev) => [
                ...prev,
                { position: 100, height, type: obstacleType, scored: false }
            ]);
        };

        const scheduleNextObstacle = () => {
            const nextInterval = getObstacleInterval();
            obstacleTimeoutRef.current = setTimeout(() => {
                addObstacle();
                scheduleNextObstacle();
            }, nextInterval);
        };

        scheduleNextObstacle();

        return () => {
            if (obstacleTimeoutRef.current) {
                clearTimeout(obstacleTimeoutRef.current);
            }
        };
    }, [gameOver]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md"
            onClick={gameOver ? resetGame : handleJump}
        >
            <div className="relative w-full max-w-3xl mx-auto px-4">
                <div className="bg-card rounded-2xl p-8 shadow-2xl border border-border">
                    {/* Score and Title */}
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-2xl font-bold text-foreground">
                                Starting the agent...
                            </h3>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-bold text-foreground tabular-nums">
                                {score}
                            </div>
                            <div className="text-xs text-muted-foreground">SCORE</div>
                        </div>
                    </div>

                    {/* Game Container */}
                    <div
                        ref={gameContainerRef}
                        className="relative h-64 bg-muted rounded-xl overflow-hidden border-2 border-border shadow-inner"
                    >
                        {/* Clouds */}
                        {clouds.map((cloud, index) => (
                            <div
                                key={index}
                                className="absolute"
                                style={{
                                    left: `${cloud.position}%`,
                                    top: `${cloud.yPosition}%`,
                                    transition: 'left 0.05s linear',
                                }}
                            >
                                <svg width="50" height="20" viewBox="0 0 50 20" className="opacity-40">
                                    <ellipse cx="12" cy="12" rx="8" ry="6" fill="currentColor" className="text-muted-foreground" />
                                    <ellipse cx="22" cy="10" rx="10" ry="8" fill="currentColor" className="text-muted-foreground" />
                                    <ellipse cx="35" cy="12" rx="8" ry="6" fill="currentColor" className="text-muted-foreground" />
                                </svg>
                            </div>
                        ))}

                        {/* Ground with pattern */}
                        <div className="absolute bottom-0 left-0 right-0 h-16 bg-secondary/20">
                            {/* Ground line pattern */}
                            <div
                                className="absolute top-0 left-0 right-0 h-0.5 text-border"
                                style={{
                                    backgroundImage: 'repeating-linear-gradient(to right, currentColor 0, currentColor 10px, transparent 10px, transparent 20px)',
                                    transform: `translateX(-${groundOffset}px)`,
                                }}
                            ></div>
                        </div>

                        {/* Dino */}
                        <div
                            className={`absolute left-16 transition-all ${isJumping ? 'duration-300 ease-out' : 'duration-200 ease-in'
                                }`}
                            style={{
                                bottom: isJumping ? '120px' : '64px',
                                width: "50px",
                                height: isDucking ? "35px" : "55px",
                                transition: isJumping
                                    ? 'bottom 0.3s cubic-bezier(0.33, 1, 0.68, 1), height 0.1s ease'
                                    : 'bottom 0.2s cubic-bezier(0.6, -0.28, 0.74, 0.05), height 0.1s ease',
                            }}
                        >
                            <svg
                                viewBox={isDucking ? "0 20 50 30" : "0 0 50 55"}
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-full h-full drop-shadow-lg"
                            >
                                {!isDucking ? (
                                    <>
                                        {/* Head */}
                                        <rect x="8" y="5" width="20" height="18" fill="currentColor" className="text-primary" rx="2" />
                                        <rect x="25" y="10" width="8" height="8" fill="currentColor" className="text-primary" />

                                        {/* Eye */}
                                        <circle cx="18" cy="13" r="3" fill="currentColor" className="text-white" />
                                        <circle cx="18" cy="13" r="1.5" fill="currentColor" className="text-gray-900" />

                                        {/* Body */}
                                        <rect x="10" y="23" width="25" height="20" fill="currentColor" className="text-primary" rx="2" />

                                        {/* Arms */}
                                        <rect x="7" y="28" width="5" height="8" fill="currentColor" className="text-primary/80" rx="1" />
                                        <rect x="33" y="28" width="5" height="8" fill="currentColor" className="text-primary/80" rx="1" />

                                        {/* Legs with animation */}
                                        <rect
                                            x={legFrame < 2 ? "15" : "17"}
                                            y="43"
                                            width="7"
                                            height="12"
                                            fill="currentColor"
                                            className="text-primary/80"
                                            rx="1"
                                        />
                                        <rect
                                            x={legFrame < 2 ? "26" : "24"}
                                            y="43"
                                            width="7"
                                            height="12"
                                            fill="currentColor"
                                            className="text-primary/80"
                                            rx="1"
                                        />

                                        {/* Tail */}
                                        <polygon points="35,30 43,28 43,35 35,35" fill="currentColor" className="text-primary/80" />
                                    </>
                                ) : (
                                    <>
                                        {/* Ducking pose */}
                                        <rect x="8" y="20" width="35" height="18" fill="currentColor" className="text-primary" rx="2" />
                                        <rect x="8" y="15" width="15" height="12" fill="currentColor" className="text-primary" rx="2" />
                                        <circle cx="15" cy="20" r="2" fill="currentColor" className="text-white" />
                                        <circle cx="15" cy="20" r="1" fill="currentColor" className="text-gray-900" />
                                        <polygon points="43,25 48,23 48,28 43,28" fill="currentColor" className="text-primary/80" />
                                    </>
                                )}
                            </svg>
                        </div>

                        {/* Obstacles */}
                        {obstacles.map((obstacle, index) => (
                            <div
                                key={index}
                                className="absolute transition-all duration-50"
                                style={{
                                    left: `${obstacle.position}%`,
                                    bottom: obstacle.type === 'bird' ? '100px' : '64px',
                                }}
                            >
                                {obstacle.type === 'cactus' ? (
                                    <svg width="30" height="48" viewBox="0 0 30 48" className="drop-shadow-md">
                                        <rect x="11" y="10" width="8" height="38" fill="currentColor" className="text-primary/80" rx="2" />
                                        <rect x="5" y="20" width="8" height="15" fill="currentColor" className="text-primary/80" rx="2" />
                                        <rect x="17" y="15" width="8" height="18" fill="currentColor" className="text-primary/80" rx="2" />
                                        {/* Spikes */}
                                        <circle cx="15" cy="12" r="2" fill="currentColor" className="text-accent" />
                                        <circle cx="15" cy="22" r="2" fill="currentColor" className="text-accent" />
                                        <circle cx="15" cy="32" r="2" fill="currentColor" className="text-accent" />
                                    </svg>
                                ) : (
                                    <svg width="40" height="25" viewBox="0 0 40 25" className="drop-shadow-md animate-bounce" style={{ animationDuration: '0.5s' }}>
                                        {/* Bird */}
                                        <ellipse cx="20" cy="12" rx="15" ry="8" fill="currentColor" className="text-muted-foreground" />
                                        <polygon points="5,12 0,10 0,14" fill="currentColor" className="text-muted-foreground" />
                                        <polygon points="35,12 40,10 40,14" fill="currentColor" className="text-muted-foreground" />
                                        <circle cx="23" cy="10" r="2" fill="currentColor" className="text-white" />
                                        <circle cx="28" cy="12" r="3" fill="currentColor" className="text-accent" />
                                    </svg>
                                )}
                            </div>
                        ))}

                        {/* Game Over Overlay */}
                        {gameOver && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-xl">
                                <div className="text-center space-y-4">
                                    <div className="text-4xl font-bold text-white drop-shadow-lg">
                                        Game Over!
                                    </div>
                                    <div className="text-xl text-white/90">
                                        Final Score: <span className="font-bold">{score}</span>
                                    </div>
                                    <div className="text-sm text-white/70 mt-2">
                                        Press SPACE or click to restart
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="mt-6 text-center space-y-3">
                        <div className="flex items-center justify-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg border border-border">
                                <kbd className="px-2 py-1 bg-card rounded text-xs font-mono border border-border">SPACE</kbd>
                                <span className="text-sm text-muted-foreground">Jump</span>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg border border-border">
                                <kbd className="px-2 py-1 bg-card rounded text-xs font-mono border border-border">↓</kbd>
                                <span className="text-sm text-muted-foreground">Duck</span>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg border border-border">
                                <span className="text-sm text-muted-foreground">or click to jump</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-2 pt-2">
                            <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: "0.2s" }}></div>
                            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: "0.4s" }}></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
