import { User } from "../models/user";
import { UserModel } from "../database/models/userModel";

function databaseToUser(document: any): User {
    return {
        id: document.id,
        name: document.name,
        email: document.email,
        passwordHash: document.passwordHash,
        createdAt: new Date(document.createdAt),
        updatedAt: new Date(document.updatedAt),
    };
}

export class UserRepository {

    public async create(user: User): Promise<User> {
        const document = await UserModel.create({
            id: user.id,
            name: user.name,
            email: user.email,
            passwordHash: user.passwordHash,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        });

        return databaseToUser(document);
    }

    public async findByEmail(
        email: string
    ): Promise<User | null> {

        const document = await UserModel
            .findOne({ email: email.toLowerCase() })
            .lean();

        if (!document) {
            return null;
        }

        return databaseToUser(document);
    }

    public async findById(
        userId: string
    ): Promise<User | null> {

        const document = await UserModel
            .findOne({ id: userId })
            .lean();

        if (!document) {
            return null;
        }

        return databaseToUser(document);
    }
}