import { dependencyContainer } from "../../dependencies.js";
import { DependencyToken } from "../../lib/dependencyContainer/types.js";

export const getUsersByUsernames = async ({ body, set }: any) => {
	const { usernames } = body as { usernames?: Array<string> };
	const logger = dependencyContainer.resolve(DependencyToken.Logger);

	if (!usernames || !Array.isArray(usernames)) {
		logger.warn("Get users request with invalid usernames format", {
			receivedType: Array.isArray(usernames) ? "array" : typeof usernames,
		});
		set.status = 400;
		return { success: false, message: "usernames array is required" };
	}

	if (usernames.length === 0) {
		logger.info("Get users request with empty usernames array");
		return { success: true, users: [] };
	}

	const database = dependencyContainer.resolve(DependencyToken.Database);

	if (!database) {
		logger.error("Database service not available");
		set.status = 503;
		return { success: false, message: "Service unavailable" };
	}

	const usersCollection = database.getCollection("users");

	try {
		const users = await usersCollection
			.find({ username: { $in: usernames } })
			.project({ username: 1, _id: 1 })
			.toArray();

		const foundUsernames = users.map((u) => u.username);
		const notFoundUsernames = usernames.filter(
			(u) => !foundUsernames.includes(u)
		);

		logger.info("Users retrieved successfully", {
			requestedCount: usernames.length,
			foundCount: users.length,
			usernames: foundUsernames,
			notFoundUsernames,
		});

		return {
			success: true,
			users: users.map((user) => ({
				id: user._id.toString(),
				username: user.username,
			})),
			notFoundUsernames,
		};
	} catch (error) {
		logger.error("Error fetching users", {
			requestedUsernames: usernames,
			error: error instanceof Error ? error.message : String(error),
		});
		set.status = 500;
		return {
			success: false,
			message: "Internal server error",
			notFoundUsernames: [],
		};
	}
};
