import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface RuneStatus {
	current: number;
	capacity: number;
	regenIntervalSeconds: number; // effective interval per rune after modifiers
	nextRuneInSeconds: number; // seconds remaining until next rune
	nextRuneAtIso?: string; // server ISO timestamp for next rune (if any)
}

export interface TopbarData {
	level: number; // computed from total experience
	totalExperience: number;
	expInCurrentLevel: number;
	expRequiredForNextLevel: number;
	gold: number;
	scrap: number;
	runes: RuneStatus;
}

const resourceSelect = {
	id: true,
	gold: true,
	scrap: true,
	runes: true,
	runesUpdatedAt: true,
	runeCapacityBase: true,
	runeCapacityBonus: true,
	runeRegenBaseSeconds: true,
	runeRegenMultiplier: true,
	runeRegenAddSeconds: true,
} as const;

const characterSelect = {
	id: true,
	level: true,
	experience: true,
	resources: { select: resourceSelect },
} as const;

@Injectable()
export class TopbarService {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Compute effective rune regeneration interval in seconds.
	 * - multiplierMilli: 1000 = 1.0x, 500 = 0.5x (half time), 2000 = 2.0x
	 * - addSeconds: additive seconds (can be negative)
	 * Minimum interval is clamped to 60 seconds.
	 */
	private computeEffectiveIntervalSeconds(baseSeconds: number, multiplierMilli: number, addSeconds: number): number {
		const multiplied = Math.floor((baseSeconds * Math.max(100, multiplierMilli)) / 1000);
		return Math.max(60, multiplied + addSeconds);
	}

	/**
	 * Level progression from total experience.
	 * Returns current level, exp in current level, and exp required to reach the next level.
	 */
	private getLevelProgress(totalExperience: number): {
		level: number;
		expInCurrentLevel: number;
		expRequiredForNextLevel: number;
	} {
		const requiredForLevel = (level: number): number => {
			const raw = 100 + Math.pow(level, 1.6) * 75; // tunable curve
			return Math.max(100, Math.round(raw / 10) * 10);
		};

		let level = 1;
		let expRemaining = Math.max(0, Math.floor(totalExperience));
		let need = requiredForLevel(level);
		while (expRemaining >= need) {
			expRemaining -= need;
			level += 1;
			need = requiredForLevel(level);
			if (level > 200) break; // safety cap
		}
		return {
			level,
			expInCurrentLevel: expRemaining,
			expRequiredForNextLevel: need,
		};
	}

	/**
	 * Fetch top bar data for the user's character.
	 * - Calculates and persists pending rune regeneration
	 * - Returns current/capacity, next tick ETA and ISO, level/exp breakdown
	 */
	async getTopbarData(userId: string): Promise<TopbarData | null> {
		const character = await this.prisma.character.findFirst({
			where: { userId },
			select: characterSelect,
		});

		if (!character || !character.resources) return null;

		const r = character.resources;

		const capacity = Math.max(0, r.runeCapacityBase + r.runeCapacityBonus);
		const effectiveInterval = this.computeEffectiveIntervalSeconds(
			r.runeRegenBaseSeconds,
			r.runeRegenMultiplier,
			r.runeRegenAddSeconds,
		);

		const intervalMs = effectiveInterval * 1000;
		const now = new Date();
		const nowMs = now.getTime();
		const last = r.runesUpdatedAt ?? now;
		// Clamp future timestamps to now to avoid negative elapsed
		const lastMs = Math.min(last.getTime(), nowMs);
		const elapsedMs = Math.max(0, nowMs - lastMs);

		const missing = Math.max(0, capacity - r.runes);
		const ticks = intervalMs > 0 ? Math.floor(elapsedMs / intervalMs) : 0;
		const regenerated = Math.min(missing, Math.max(0, ticks));
		const newRunes = Math.min(capacity, r.runes + regenerated);
		const newLastMs = lastMs + regenerated * intervalMs;

		if (regenerated > 0) {
			await this.prisma.characterResources.update({
				where: { id: r.id },
				data: {
					runes: newRunes,
					runesUpdatedAt: new Date(newLastMs),
				},
			});
		}

		let nextRuneInSeconds = 0;
		let nextRuneAtIso: string | undefined;
		if (newRunes < capacity) {
			const nextMs = newLastMs + intervalMs;
			nextRuneInSeconds = Math.max(1, Math.ceil((nextMs - nowMs) / 1000));
			nextRuneAtIso = new Date(nextMs).toISOString();
		}

		const lp = this.getLevelProgress(character.experience);

		return {
			level: lp.level,
			totalExperience: character.experience,
			expInCurrentLevel: lp.expInCurrentLevel,
			expRequiredForNextLevel: lp.expRequiredForNextLevel,
			gold: r.gold,
			scrap: r.scrap,
			runes: {
				current: newRunes,
				capacity,
				regenIntervalSeconds: effectiveInterval,
				nextRuneInSeconds,
				nextRuneAtIso,
			}
		};
	}

	/**
	 * Consume one or more runes after applying pending regeneration.
	 * Throws if there are not enough runes.
	 */
	async consumeRune(userId: string, count = 1): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			const character = await tx.character.findFirst({
				where: { userId },
				select: characterSelect,
			});

			if (!character || !character.resources) return;
			const r = character.resources;

			const capacity = Math.max(0, r.runeCapacityBase + r.runeCapacityBonus);
			const effectiveInterval = this.computeEffectiveIntervalSeconds(
				r.runeRegenBaseSeconds,
				r.runeRegenMultiplier,
				r.runeRegenAddSeconds,
			);
			const now = new Date();
			const last = r.runesUpdatedAt ?? now;
			const elapsedSeconds = Math.max(
				0,
				Math.floor((now.getTime() - last.getTime()) / 1000),
			);

			const missing = Math.max(0, capacity - r.runes);
			let regenerated = 0;
			if (missing > 0 && elapsedSeconds > 0) {
				regenerated = Math.floor(elapsedSeconds / effectiveInterval);
				if (regenerated > missing) regenerated = missing;
			}

			let newRunes = Math.min(capacity, r.runes + regenerated);
			if (newRunes < count) {
				throw new Error('Not enough runes');
			}
			newRunes -= count;

			await tx.characterResources.update({
				where: { id: r.id },
				data: {
					runes: newRunes,
					runesUpdatedAt: new Date(),
				},
			});
		});
	}

	/**
	 * Adjust rune capacity bonus (e.g., premium +1, skill +1) and clamp runes to new capacity.
	 * Applies pending regeneration before changing capacity.
	 */
	async grantRuneCapacityBonus(userId: string, delta: number): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			const character = await tx.character.findFirst({
				where: { userId },
				select: characterSelect,
			});
			if (!character || !character.resources) return;
			const r = character.resources;
			const capacity = Math.max(0, r.runeCapacityBase + r.runeCapacityBonus);
			const effectiveInterval = this.computeEffectiveIntervalSeconds(
				r.runeRegenBaseSeconds,
				r.runeRegenMultiplier,
				r.runeRegenAddSeconds,
			);
			const now = new Date();
			const last = r.runesUpdatedAt ?? now;
			const elapsedSeconds = Math.max(
				0,
				Math.floor((now.getTime() - last.getTime()) / 1000),
			);
			const missing = Math.max(0, capacity - r.runes);
			let regenerated = 0;
			if (missing > 0 && elapsedSeconds > 0) {
				regenerated = Math.floor(elapsedSeconds / effectiveInterval);
				if (regenerated > missing) regenerated = missing;
			}

			const newBonus = Math.max(0, r.runeCapacityBonus + delta);
			const newCapacity = Math.max(0, r.runeCapacityBase + newBonus);
			const newRunes = Math.min(newCapacity, r.runes + regenerated);

			await tx.characterResources.update({
				where: { id: r.id },
				data: ({
					runeCapacityBonus: newBonus,
					runes: newRunes,
					runesUpdatedAt: new Date(),
				} as unknown) as any,
			});
		});
	}

	/**
	 * Additive timer change in seconds (can be negative). Useful for small buffs/debuffs.
	 * Applies pending regeneration before updating.
	 */
	async adjustRuneRegenSeconds(userId: string, addSecondsDelta: number): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			const character = await tx.character.findFirst({
				where: { userId },
				select: characterSelect,
			});
			if (!character || !character.resources) return;
			const r = character.resources;
			const capacity = Math.max(0, r.runeCapacityBase + r.runeCapacityBonus);
			const effectiveInterval = this.computeEffectiveIntervalSeconds(
				r.runeRegenBaseSeconds,
				r.runeRegenMultiplier,
				r.runeRegenAddSeconds,
			);
			const now = new Date();
			const last = r.runesUpdatedAt ?? now;
			const elapsedSeconds = Math.max(
				0,
				Math.floor((now.getTime() - last.getTime()) / 1000),
			);
			const missing = Math.max(0, capacity - r.runes);
			let regenerated = 0;
			if (missing > 0 && elapsedSeconds > 0) {
				regenerated = Math.floor(elapsedSeconds / effectiveInterval);
				if (regenerated > missing) regenerated = missing;
			}

			const newAddSeconds = r.runeRegenAddSeconds + addSecondsDelta;

			await tx.characterResources.update({
				where: { id: r.id },
				data: ({
					runeRegenAddSeconds: newAddSeconds,
					runes: Math.min(capacity, r.runes + regenerated),
					runesUpdatedAt: new Date(),
				} as unknown) as any,
			});
		});
	}

	/**
	 * Set a multiplier for regen speed in milli-units. 1000=1x, 500=0.5x time (faster regen).
	 * Applies pending regeneration before updating.
	 */
	async setRuneRegenMultiplier(userId: string, multiplierMilli: number): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			const character = await tx.character.findFirst({
				where: { userId },
				select: characterSelect,
			});
			if (!character || !character.resources) return;
			const r = character.resources;

			const capacity = Math.max(0, r.runeCapacityBase + r.runeCapacityBonus);
			const effectiveInterval = this.computeEffectiveIntervalSeconds(
				r.runeRegenBaseSeconds,
				r.runeRegenMultiplier,
				r.runeRegenAddSeconds,
			);
			const now = new Date();
			const last = r.runesUpdatedAt ?? now;
			const elapsedSeconds = Math.max(
				0,
				Math.floor((now.getTime() - last.getTime()) / 1000),
			);
			const missing = Math.max(0, capacity - r.runes);
			let regenerated = 0;
			if (missing > 0 && elapsedSeconds > 0) {
				regenerated = Math.floor(elapsedSeconds / effectiveInterval);
				if (regenerated > missing) regenerated = missing;
			}

			await tx.characterResources.update({
				where: { id: r.id },
				data: ({
					runeRegenMultiplier: Math.max(100, multiplierMilli),
					runes: Math.min(capacity, r.runes + regenerated),
					runesUpdatedAt: new Date(),
				} as unknown) as any,
			});
		});
	}

	/**
	 * Refill missing runes by amount after accounting for pending regeneration.
	 * Clamps to capacity.
	 */
	async useRuneRefill(userId: string, amount: number): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			const character = await tx.character.findFirst({
				where: { userId },
				select: characterSelect,
			});
			if (!character || !character.resources) return;
			const r = character.resources;

			const capacity = Math.max(0, r.runeCapacityBase + r.runeCapacityBonus);
			const now = new Date();
			const last = r.runesUpdatedAt ?? now;
			const effectiveInterval = this.computeEffectiveIntervalSeconds(
				r.runeRegenBaseSeconds,
				r.runeRegenMultiplier,
				r.runeRegenAddSeconds,
			);
			const elapsedSeconds = Math.max(
				0,
				Math.floor((now.getTime() - last.getTime()) / 1000),
			);
			const missingBefore = Math.max(0, capacity - r.runes);
			let regenerated = 0;
			if (missingBefore > 0 && elapsedSeconds > 0) {
				regenerated = Math.floor(elapsedSeconds / effectiveInterval);
			}
			const preRefill = Math.min(capacity, r.runes + regenerated);
			const afterRefill = Math.min(capacity, preRefill + Math.max(0, amount));

			await tx.characterResources.update({
				where: { id: r.id },
				data: {
					runes: afterRefill,
					runesUpdatedAt: new Date(),
				},
			});
		});
	}
}


