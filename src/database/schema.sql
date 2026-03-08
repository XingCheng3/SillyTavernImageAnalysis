-- Create Users table
CREATE TABLE Users (
    UserId INT IDENTITY(1,1) PRIMARY KEY,
    Username NVARCHAR(50) NOT NULL UNIQUE,
    Password NVARCHAR(100) NOT NULL,
    Email NVARCHAR(100) NOT NULL UNIQUE,
    CreatedAt DATETIME DEFAULT GETDATE(),
    LastLogin DATETIME,
    IsActive BIT DEFAULT 1
);

-- Create Roles table
CREATE TABLE Roles (
    RoleId INT IDENTITY(1,1) PRIMARY KEY,
    RoleName NVARCHAR(50) NOT NULL UNIQUE,
    Description NVARCHAR(200),
    CreatedAt DATETIME DEFAULT GETDATE()
);

-- Create UserRoles mapping table
CREATE TABLE UserRoles (
    UserId INT,
    RoleId INT,
    PRIMARY KEY (UserId, RoleId),
    FOREIGN KEY (UserId) REFERENCES Users(UserId),
    FOREIGN KEY (RoleId) REFERENCES Roles(RoleId)
);

-- Create Permissions table
CREATE TABLE Permissions (
    PermissionId INT IDENTITY(1,1) PRIMARY KEY,
    PermissionName NVARCHAR(50) NOT NULL UNIQUE,
    Description NVARCHAR(200),
    ModuleName NVARCHAR(50) NOT NULL
);

-- Create RolePermissions mapping table
CREATE TABLE RolePermissions (
    RoleId INT,
    PermissionId INT,
    PRIMARY KEY (RoleId, PermissionId),
    FOREIGN KEY (RoleId) REFERENCES Roles(RoleId),
    FOREIGN KEY (PermissionId) REFERENCES Permissions(PermissionId)
);

-- Create Models table
CREATE TABLE Models (
    ModelId INT IDENTITY(1,1) PRIMARY KEY,
    ModelName NVARCHAR(100) NOT NULL UNIQUE,
    Description NVARCHAR(500),
    CreatedAt DATETIME DEFAULT GETDATE(),
    CreatedBy INT,
    IsPublic BIT DEFAULT 1,
    FOREIGN KEY (CreatedBy) REFERENCES Users(UserId)
);

-- Create Modelfiles table
CREATE TABLE Modelfiles (
    ModelfileId INT IDENTITY(1,1) PRIMARY KEY,
    ModelId INT,
    FileName NVARCHAR(100) NOT NULL,
    Content NVARCHAR(MAX) NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    CreatedBy INT,
    FOREIGN KEY (ModelId) REFERENCES Models(ModelId),
    FOREIGN KEY (CreatedBy) REFERENCES Users(UserId)
);

-- Create ChatHistory table
CREATE TABLE ChatHistory (
    ChatId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT,
    ModelId INT,
    Title NVARCHAR(200),
    CreatedAt DATETIME DEFAULT GETDATE(),
    LastUpdated DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (UserId) REFERENCES Users(UserId),
    FOREIGN KEY (ModelId) REFERENCES Models(ModelId)
);

-- Create ChatMessages table
CREATE TABLE ChatMessages (
    MessageId INT IDENTITY(1,1) PRIMARY KEY,
    ChatId INT,
    Role NVARCHAR(20) NOT NULL,
    Content NVARCHAR(MAX) NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (ChatId) REFERENCES ChatHistory(ChatId)
);

-- Create Servers table
CREATE TABLE Servers (
    ServerId INT IDENTITY(1,1) PRIMARY KEY,
    ServerName NVARCHAR(100) NOT NULL,
    Host NVARCHAR(100) NOT NULL,
    Port INT NOT NULL,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME DEFAULT GETDATE(),
    CreatedBy INT,
    FOREIGN KEY (CreatedBy) REFERENCES Users(UserId)
);

-- Create ServerModels mapping table
CREATE TABLE ServerModels (
    ServerId INT,
    ModelId INT,
    PRIMARY KEY (ServerId, ModelId),
    FOREIGN KEY (ServerId) REFERENCES Servers(ServerId),
    FOREIGN KEY (ModelId) REFERENCES Models(ModelId)
);

-- Create stored procedure for user authentication
CREATE PROCEDURE sp_AuthenticateUser
    @Username NVARCHAR(50),
    @Password NVARCHAR(100)
AS
BEGIN
    SELECT u.UserId, u.Username, u.Email, r.RoleId, r.RoleName
    FROM Users u
    LEFT JOIN UserRoles ur ON u.UserId = ur.UserId
    LEFT JOIN Roles r ON ur.RoleId = r.RoleId
    WHERE u.Username = @Username AND u.Password = @Password AND u.IsActive = 1;
END;

-- Create stored procedure for getting user permissions
CREATE PROCEDURE sp_GetUserPermissions
    @UserId INT
AS
BEGIN
    SELECT DISTINCT p.PermissionId, p.PermissionName, p.Description, p.ModuleName
    FROM Users u
    JOIN UserRoles ur ON u.UserId = ur.UserId
    JOIN RolePermissions rp ON ur.RoleId = rp.RoleId
    JOIN Permissions p ON rp.PermissionId = p.PermissionId
    WHERE u.UserId = @UserId;
END;

-- Create stored procedure for getting available models
CREATE PROCEDURE sp_GetAvailableModels
    @UserId INT
AS
BEGIN
    SELECT m.ModelId, m.ModelName, m.Description, m.IsPublic
    FROM Models m
    WHERE m.IsPublic = 1 OR m.CreatedBy = @UserId;
END;

-- Create stored procedure for saving chat history
CREATE PROCEDURE sp_SaveChatMessage
    @ChatId INT,
    @Role NVARCHAR(20),
    @Content NVARCHAR(MAX)
AS
BEGIN
    INSERT INTO ChatMessages (ChatId, Role, Content)
    VALUES (@ChatId, @Role, @Content);
    
    UPDATE ChatHistory
    SET LastUpdated = GETDATE()
    WHERE ChatId = @ChatId;
END; 