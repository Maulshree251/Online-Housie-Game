
import mongoose from "mongoose";

export async function connectDatabase(): Promise<void> {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        throw new Error("MONGODB_URI is not defined.");
    }

    await mongoose.connect(mongoUri);

    console.log("Connected to MongoDB.");
}


export async function disconnectDatabase(): Promise<void> {
    await mongoose.disconnect();

    console.log("Disconnected from MongoDB.");
}