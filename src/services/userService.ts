import { UserRepository } from "../repositories/userRepository";

export class UserService {

    constructor(
        private userRepository: UserRepository
    ) { }

    public async getProfile(userId: string) {

        const user =
            await this.userRepository.findById(userId);

        if (!user) {
            throw new Error("User not found.");
        }

        return {
            id: user.id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }

    public async updateProfile(
        userId: string,
        input: {
            name?: string;
            email?: string;
        }
    ) {

        const updates: {
            name?: string;
            email?: string;
        } = {};

        if (input.name !== undefined) {
            const name = input.name.trim();

            if (!name) {
                throw new Error("Name cannot be empty.");
            }

            updates.name = name;
        }

        if (input.email !== undefined) {
            const email =
                input.email.trim().toLowerCase();

            if (!email) {
                throw new Error("Email cannot be empty.");
            }

            const existingUser =
                await this.userRepository.findByEmail(email);

            if (
                existingUser &&
                existingUser.id !== userId
            ) {
                throw new Error(
                    "An account with this email already exists."
                );
            }

            updates.email = email;
        }

        if (
            updates.name === undefined &&
            updates.email === undefined
        ) {
            throw new Error(
                "At least one profile field is required."
            );
        }

        const user =
            await this.userRepository.updateProfile(
                userId,
                updates
            );

        if (!user) {
            throw new Error("User not found.");
        }

        return {
            id: user.id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }
}