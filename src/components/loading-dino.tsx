"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface Obstacle {
    position: number;
    lane: number; // 0, 1, or 2 (left, center, right)
    type: 'popup' | 'ad' | 'cookie' | 'bot';
    scored?: boolean;
}

interface Collectible {
    position: number;
    lane: number;
    type: 'coin' | 'powerup';
}

export function LoadingDino() {
    const [currentLane, setCurrentLane] = useState(1); // 0 = left, 1 = center, 2 = right
    const [isJumping, setIsJumping] = useState(false);
    const [obstacles, setObstacles] = useState<Obstacle[]>([]);
    const [collectibles, setCollectibles] = useState<Collectible[]>([]);
    const [score, setScore] = useState(0);
    const [bestScore, setBestScore] = useState(0);
    const [groundOffset, setGroundOffset] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [obstacleSpeed, setObstacleSpeed] = useState(1.5);
    const gameContainerRef = useRef<HTMLDivElement>(null);
    const scoreRef = useRef(0);
    const obstacleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const collectibleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Load best score from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('browser-runner-best-score');
        if (saved) {
            setBestScore(parseInt(saved, 10));
        }
    }, []);

    // Get lane X position (percentage)
    const getLaneX = useCallback((lane: number) => {
        const lanePositions = [20, 50, 80]; // Left, Center, Right lanes
        return lanePositions[lane];
    }, []);

    // Collision detection function
    const checkCollision = useCallback(() => {
        if (!gameContainerRef.current || obstacles.length === 0) return false;

        const containerWidth = gameContainerRef.current.offsetWidth;
        const containerHeight = 256; // h-64 = 256px

        // Hitbox padding for fairer gameplay
        const hitboxPadding = 8;

        // Cursor horizontal position based on lane
        const cursorLaneX = getLaneX(currentLane);
        const cursorLeftPx = (cursorLaneX / 100) * containerWidth - 15 + hitboxPadding;
        const cursorWidth = 30 - (hitboxPadding * 2);
        const cursorRightPx = cursorLeftPx + cursorWidth;

        // Cursor vertical position
        const cursorBottomFromBottom = isJumping ? 120 : 64;
        const cursorHeight = 30;
        const cursorTopPx = containerHeight - cursorBottomFromBottom - cursorHeight + hitboxPadding;
        const cursorBottomPx = containerHeight - cursorBottomFromBottom;

        for (const obstacle of obstacles) {
            // Only check collision if obstacle is in the same lane
            if (obstacle.lane !== currentLane) continue;

            // Obstacle horizontal position: combine position (0-100%) with lane offset (matching rendering logic)
            const laneOffset = getLaneX(obstacle.lane) - 50; // Offset from center
            const obstacleBaseLeftPx = (obstacle.position / 100) * containerWidth;
            const obstacleLaneOffsetPx = (laneOffset / 100) * containerWidth;
            const obstacleCenterPx = obstacleBaseLeftPx + obstacleLaneOffsetPx;
            const obstacleWidth = obstacle.type === 'popup' ? 40 : obstacle.type === 'bot' ? 35 : 30;
            const obstacleLeftPx = obstacleCenterPx - obstacleWidth / 2 + hitboxPadding;
            const obstacleRightPx = obstacleLeftPx + obstacleWidth - (hitboxPadding * 2);

            // Obstacle vertical position - all obstacles are on the ground
            const obstacleBottomFromBottom = 64;
            const obstacleHeight = obstacle.type === 'popup' ? 50 : obstacle.type === 'bot' ? 40 : 35;
            const obstacleTopPx = containerHeight - obstacleBottomFromBottom - obstacleHeight + hitboxPadding;
            const obstacleBottomPx = containerHeight - obstacleBottomFromBottom;

            // AABB collision detection
            const horizontalOverlap = cursorRightPx > obstacleLeftPx && cursorLeftPx < obstacleRightPx;
            const verticalOverlap = cursorBottomPx > obstacleTopPx && cursorTopPx < obstacleBottomPx;

            if (horizontalOverlap && verticalOverlap) {
                return true;
            }
        }
        return false;
    }, [obstacles, currentLane, isJumping, getLaneX]);

    const handleJump = useCallback(() => {
        if (!isJumping && !gameOver) {
            setIsJumping(true);
            setTimeout(() => setIsJumping(false), 600);
        }
    }, [isJumping, gameOver]);

    const handleMoveLeft = useCallback(() => {
        if (!gameOver && currentLane > 0) {
            setCurrentLane(currentLane - 1);
        }
    }, [currentLane, gameOver]);

    const handleMoveRight = useCallback(() => {
        if (!gameOver && currentLane < 2) {
            setCurrentLane(currentLane + 1);
        }
    }, [currentLane, gameOver]);

    const resetGame = useCallback(() => {
        setGameOver(false);
        setScore(0);
        scoreRef.current = 0;
        setObstacles([]);
        setCollectibles([]);
        setObstacleSpeed(1.5);
        setIsJumping(false);
        setCurrentLane(1);
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

                    // Add score when obstacle passes the cursor
                    if (newObs.position < 40 && !newObs.scored) {
                        newObs.scored = true;
                        scoreRef.current += 1;
                        setScore(scoreRef.current);
                        // Increase speed every 5 points
                        if (scoreRef.current % 5 === 0) {
                            setObstacleSpeed((speed) => Math.min(speed + 0.15, 4));
                        }
                    }

                    return newObs;
                }).filter((obs) => obs.position > -10);

                return updated;
            });

            // Animate collectibles
            setCollectibles((prev) => {
                return prev.map((col) => ({
                    ...col,
                    position: col.position - obstacleSpeed,
                })).filter((col) => {
                    // Check if cursor collected this collectible (collectibles are floating, so can be collected when jumping)
                    if (col.lane === currentLane && col.position < 50 && col.position > 30) {
                        scoreRef.current += col.type === 'coin' ? 5 : 10;
                        setScore(scoreRef.current);
                        return false;
                    }
                    return col.position > -10;
                });
            });

            // Animate ground (browser tabs)
            setGroundOffset((prev) => (prev + obstacleSpeed * 0.8) % 20);

            // Check for collisions
            if (checkCollision()) {
                setGameOver(true);
                // Update best score if current score is higher
                if (scoreRef.current > bestScore) {
                    setBestScore(scoreRef.current);
                    localStorage.setItem('browser-runner-best-score', scoreRef.current.toString());
                }
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
            } else if (e.code === "ArrowLeft") {
                e.preventDefault();
                handleMoveLeft();
            } else if (e.code === "ArrowRight") {
                e.preventDefault();
                handleMoveRight();
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            clearInterval(interval);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [handleJump, handleMoveLeft, handleMoveRight, checkCollision, obstacleSpeed, gameOver, resetGame, bestScore, currentLane, isJumping]);

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
            const lane = Math.floor(Math.random() * 3); // Random lane 0, 1, or 2
            const obstacleTypes: Array<'popup' | 'ad' | 'cookie' | 'bot'> = ['popup', 'ad', 'cookie', 'bot'];
            const obstacleType = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];

            setObstacles((prev) => [
                ...prev,
                { position: 100, lane, type: obstacleType, scored: false }
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

    // Handle collectible spawning
    useEffect(() => {
        if (gameOver) return;

        const addCollectible = () => {
            const random = Math.random();
            if (random > 0.7) { // 30% chance to spawn collectible
                const lane = Math.floor(Math.random() * 3);
                const type: 'coin' | 'powerup' = random > 0.85 ? 'powerup' : 'coin';
                setCollectibles((prev) => [
                    ...prev,
                    { position: 100, lane, type }
                ]);
            }
        };

        const scheduleNextCollectible = () => {
            collectibleTimeoutRef.current = setTimeout(() => {
                addCollectible();
                scheduleNextCollectible();
            }, 1500);
        };

        scheduleNextCollectible();

        return () => {
            if (collectibleTimeoutRef.current) {
                clearTimeout(collectibleTimeoutRef.current);
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
                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <div className="text-3xl font-bold text-foreground tabular-nums">
                                    {score}
                                </div>
                                <div className="text-xs text-muted-foreground">SCORE</div>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-muted-foreground tabular-nums">
                                    {bestScore}
                                </div>
                                <div className="text-xs text-muted-foreground">BEST</div>
                            </div>
                        </div>
                    </div>

                    {/* Game Container */}
                    <div
                        ref={gameContainerRef}
                        className="relative h-64 bg-gradient-to-b from-blue-50/50 to-blue-100/30 dark:from-blue-950/30 dark:to-blue-900/20 rounded-xl overflow-hidden border-2 border-border shadow-inner"
                    >
                        {/* Background browser windows */}
                        <div className="absolute inset-0 opacity-20">
                            {[0, 1, 2].map((i) => (
                                <div
                                    key={i}
                                    className="absolute"
                                    style={{
                                        left: `${20 + i * 30}%`,
                                        top: `${15 + i * 10}%`,
                                        transform: `translateX(-${groundOffset * 0.3}px)`,
                                    }}
                                >
                                    <svg width="40" height="30" viewBox="0 0 40 30" className="text-muted-foreground">
                                        <rect x="0" y="0" width="40" height="30" fill="currentColor" rx="2" />
                                        <rect x="2" y="2" width="36" height="6" fill="currentColor" opacity="0.3" rx="1" />
                                        <rect x="4" y="10" width="32" height="2" fill="currentColor" opacity="0.2" />
                                        <rect x="4" y="14" width="24" height="2" fill="currentColor" opacity="0.2" />
                                    </svg>
                                </div>
                            ))}
                        </div>

                        {/* Lane dividers */}
                        <div className="absolute inset-0 flex">
                            {[0, 1, 2].map((lane) => (
                                <div
                                    key={lane}
                                    className="flex-1 border-r border-border/30 last:border-r-0"
                                    style={{ borderStyle: 'dashed' }}
                                />
                            ))}
                        </div>

                        {/* Ground with browser tabs */}
                        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-blue-200/40 to-blue-100/20 dark:from-blue-800/40 dark:to-blue-900/20">
                            {/* Browser tabs pattern */}
                            <div
                                className="absolute top-0 left-0 right-0 h-8 flex gap-2"
                                style={{
                                    transform: `translateX(-${groundOffset}px)`,
                                }}
                            >
                                {Array.from({ length: 20 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="w-16 h-6 bg-card/60 rounded-t-lg border border-border/50 flex items-center justify-center"
                                    >
                                        <div className="w-2 h-2 bg-primary/40 rounded-full"></div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Cursor Character */}
                        <div
                            className="absolute transition-all duration-200 ease-out"
                            style={{
                                left: `${getLaneX(currentLane)}%`,
                                bottom: isJumping ? '120px' : '64px',
                                transform: 'translateX(-50%)',
                                width: "30px",
                                height: "30px",
                                transition: isJumping
                                    ? 'bottom 0.3s cubic-bezier(0.33, 1, 0.68, 1), left 0.2s ease-out'
                                    : 'bottom 0.2s cubic-bezier(0.6, -0.28, 0.74, 0.05), left 0.2s ease-out',
                                willChange: 'bottom, left',
                            }}
                        >
                            <svg
                                viewBox="0 0 30 30"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-full h-full drop-shadow-lg"
                            >
                                {/* Cursor pointer */}
                                <path
                                    d="M 3 3 L 3 18 L 10 18 L 10 25 L 20 12 L 12 12 L 20 3 Z"
                                    fill="currentColor"
                                    className="text-primary"
                                    stroke="white"
                                    strokeWidth="1.5"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </div>

                        {/* Collectibles */}
                        {collectibles.map((collectible, index) => {
                            const laneOffset = getLaneX(collectible.lane) - 50; // Offset from center
                            return (
                                <div
                                    key={`collectible-${index}`}
                                    className="absolute"
                                    style={{
                                        left: `calc(${collectible.position}% + ${laneOffset}%)`,
                                        bottom: '80px',
                                        transform: 'translateX(-50%)',
                                        willChange: 'left',
                                    }}
                                >
                                {collectible.type === 'coin' ? (
                                    <svg width="20" height="20" viewBox="0 0 20 20" className="drop-shadow-md animate-bounce" style={{ animationDuration: '0.8s' }}>
                                        <circle cx="10" cy="10" r="8" fill="currentColor" className="text-yellow-500" />
                                        <circle cx="10" cy="10" r="6" fill="currentColor" className="text-yellow-400" />
                                        <text x="10" y="13" textAnchor="middle" className="text-xs font-bold fill-yellow-900">$</text>
                                    </svg>
                                ) : (
                                    <svg width="24" height="24" viewBox="0 0 24 24" className="drop-shadow-md animate-bounce" style={{ animationDuration: '0.8s' }}>
                                        <circle cx="12" cy="12" r="10" fill="currentColor" className="text-green-500" />
                                        <path d="M 8 12 L 11 15 L 16 9" stroke="currentColor" strokeWidth="2" fill="none" className="text-white" />
                                    </svg>
                                )}
                                </div>
                            );
                        })}

                        {/* Obstacles */}
                        {obstacles.map((obstacle, index) => {
                            const laneOffset = getLaneX(obstacle.lane) - 50; // Offset from center
                            return (
                                <div
                                    key={index}
                                    className="absolute"
                                    style={{
                                        left: `calc(${obstacle.position}% + ${laneOffset}%)`,
                                        bottom: '64px',
                                        transform: 'translateX(-50%)',
                                        willChange: 'left',
                                    }}
                                >
                                {obstacle.type === 'popup' ? (
                                    <svg width="40" height="50" viewBox="0 0 40 50" className="drop-shadow-md">
                                        <rect x="0" y="0" width="40" height="50" fill="currentColor" className="text-red-500" rx="2" />
                                        <rect x="2" y="2" width="36" height="8" fill="currentColor" className="text-red-600" rx="1" />
                                        <circle cx="8" cy="6" r="2" fill="currentColor" className="text-white" />
                                        <rect x="4" y="12" width="32" height="4" fill="currentColor" className="text-white/80" />
                                        <rect x="4" y="18" width="24" height="4" fill="currentColor" className="text-white/60" />
                                        <rect x="8" y="28" width="12" height="8" fill="currentColor" className="text-white" rx="1" />
                                    </svg>
                                ) : obstacle.type === 'ad' ? (
                                    <svg width="35" height="35" viewBox="0 0 35 35" className="drop-shadow-md">
                                        <rect x="0" y="0" width="35" height="35" fill="currentColor" className="text-orange-500" rx="2" />
                                        <rect x="2" y="2" width="31" height="31" fill="currentColor" className="text-orange-400" rx="1" />
                                        <text x="17.5" y="20" textAnchor="middle" className="text-xs font-bold fill-orange-900">AD</text>
                                    </svg>
                                ) : obstacle.type === 'cookie' ? (
                                    <svg width="30" height="30" viewBox="0 0 30 30" className="drop-shadow-md">
                                        <circle cx="15" cy="15" r="12" fill="currentColor" className="text-amber-600" />
                                        <circle cx="15" cy="15" r="10" fill="currentColor" className="text-amber-500" />
                                        <circle cx="10" cy="10" r="1.5" fill="currentColor" className="text-amber-800" />
                                        <circle cx="20" cy="12" r="1.5" fill="currentColor" className="text-amber-800" />
                                        <circle cx="12" cy="18" r="1.5" fill="currentColor" className="text-amber-800" />
                                        <circle cx="18" cy="20" r="1.5" fill="currentColor" className="text-amber-800" />
                                    </svg>
                                ) : (
                                    <svg width="35" height="40" viewBox="0 0 35 40" className="drop-shadow-md">
                                        {/* Bot */}
                                        <rect x="5" y="5" width="25" height="30" fill="currentColor" className="text-blue-600" rx="3" />
                                        <rect x="8" y="8" width="19" height="12" fill="currentColor" className="text-blue-500" rx="1" />
                                        <circle cx="13" cy="14" r="2" fill="currentColor" className="text-white" />
                                        <circle cx="21" cy="14" r="2" fill="currentColor" className="text-white" />
                                        <rect x="10" y="22" width="15" height="3" fill="currentColor" className="text-white" rx="1" />
                                        <rect x="12" y="28" width="11" height="4" fill="currentColor" className="text-blue-400" rx="1" />
                                    </svg>
                                )}
                                </div>
                            );
                        })}

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
                                    {score === bestScore && score > 0 && (
                                        <div className="text-lg text-yellow-400 font-bold animate-pulse">
                                            New Best Score!
                                        </div>
                                    )}
                                    {score < bestScore && (
                                        <div className="text-sm text-white/70">
                                            Best: <span className="font-bold">{bestScore}</span>
                                        </div>
                                    )}
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
                                <kbd className="px-2 py-1 bg-card rounded text-xs font-mono border border-border">←</kbd>
                                <span className="text-sm text-muted-foreground">Left</span>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg border border-border">
                                <kbd className="px-2 py-1 bg-card rounded text-xs font-mono border border-border">→</kbd>
                                <span className="text-sm text-muted-foreground">Right</span>
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
