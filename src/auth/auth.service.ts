import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async loginGuest(playerId: string) {
    // Try to find existing guest auth
    const auth = await this.prisma.authProvider.findUnique({
      where: {
        provider_providerId: {
          provider: 'guest',
          providerId: playerId,
        },
      },
      include: { user: true },
    });

    if (auth) {
      return this.createJwt(auth.user);
    }

    // Create new user + guest provider
    const user = await this.prisma.user.create({
      data: {
        authProviders: {
          create: {
            provider: 'guest',
            providerId: playerId,
          },
        },
      },
    });

    return this.createJwt(user);
  }

  async loginFacebook(playerId: string, fbUserId: string) {
    const existingFbAuth = await this.prisma.authProvider.findUnique({
      where: {
        provider_providerId: {
          provider: 'facebook',
          providerId: fbUserId,
        },
      },
      include: { user: true },
    });

    if (existingFbAuth) return this.createJwt(existingFbAuth.user);

    const guestAuth = await this.prisma.authProvider.findUnique({
      where: {
        provider_providerId: {
          provider: 'guest',
          providerId: playerId,
        },
      },
      include: { user: true },
    });

    if (guestAuth) {
      const alreadyLinkedFb = await this.prisma.authProvider.findFirst({
        where: {
          userId: guestAuth.userId,
          provider: 'facebook',
        },
      });

      if (alreadyLinkedFb) {
        // playerId reused by a different FB account — fork to new user
        const newUser = await this.prisma.user.create({
          data: {
            authProviders: {
              create: {
                provider: 'facebook',
                providerId: fbUserId,
              },
            },
          },
        });
        return this.createJwt(newUser);
      } else {
        // Safe to link
        await this.prisma.authProvider.create({
          data: {
            provider: 'facebook',
            providerId: fbUserId,
            userId: guestAuth.userId,
          },
        });
        return this.createJwt(guestAuth.user);
      }
    } else {
      // No guest, no fb — create both
      const newUser = await this.prisma.user.create({
        data: {
          authProviders: {
            createMany: {
              data: [
                { provider: 'guest', providerId: playerId },
                { provider: 'facebook', providerId: fbUserId },
              ],
            },
          },
        },
      });
      return this.createJwt(newUser);
    }
  }

  private createJwt(user: { id: string }) {
    const payload = { sub: user.id };
    return {
      access_token: this.jwt.sign(payload),
    };
  }
}
