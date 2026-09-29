import crypto from "crypto";
import { verifyPassword } from "./passwordService";
import {
    generateAccessToken,
    generateRefreshToken,
} from "./tokenService";
import { User } from "../models/user";
import { UserRepository } from "../repositories/userRepository";
import { hashPassword } from "./passwordService";

export interface RegisterInput {
    name: string;
    email: string;
    password: string;
}

export interface LoginInput {
    email: string;
    password: string;
}

export class AuthService {

    private userRepository: UserRepository;

    constructor(
        userRepository: UserRepository
    ) {
        this.userRepository = userRepository;
    }

    public async register(
        input: RegisterInput
    ): Promise<User> {

        const name = input.name.trim();
        const email = input.email
            .trim()
            .toLowerCase();

        if (!name) {
            throw new Error("Name is required.");
        }

        if (!email) {
            throw new Error("Email is required.");
        }

        if (!input.password) {
            throw new Error("Password is required.");
        }

        if (input.password.length < 8) {
            throw new Error(
                "Password must be at least 8 characters."
            );
        }

        const existingUser =
            await this.userRepository.findByEmail(email);

        if (existingUser) {
            throw new Error(
                "An account with this email already exists."
            );
        }

        const passwordHash =
            await hashPassword(input.password);

        const user: User = {
            id: crypto.randomUUID(),
            name,
            email,
            passwordHash,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        return this.userRepository.create(user);
    }

    public async login(input: LoginInput) {
        const email = input.email?.trim().toLowerCase();
        const password = input.password;

        if (!email || !password) {
            throw new Error("Email and password are required.");
        }

        const user = await this.userRepository.findByEmail(email);

        if (!user) {
            throw new Error("Invalid email or password.");
        }

        const passwordValid = await verifyPassword(
            password,
            user.passwordHash
        );

        if (!passwordValid) {
            throw new Error("Invalid email or password.");
        }

        const accessToken = generateAccessToken(user.id);
        const refreshToken = generateRefreshToken(user.id);

        return {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                createdAt: user.createdAt,
            },
        };
    }

    public async getCurrentUser(userId: string) {
        const user = await this.userRepository.findById(userId);

        if (!user) {
            throw new Error("User not found.");
        }

        return {
            id: user.id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
        };
    }
}

