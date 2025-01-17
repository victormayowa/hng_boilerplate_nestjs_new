import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User, UserType } from '../../modules/user/entities/user.entity';
import { Organisation } from '../../modules/organisations/entities/organisations.entity';
import { Invite } from '../../modules/invite/entities/invite.entity';
import { Product, ProductSizeType } from '../../modules/products/entities/product.entity';
import { ProductCategory } from '../../modules/product-category/entities/product-category.entity';
import { DefaultPermissions } from '../../modules/organisation-permissions/entities/default-permissions.entity';
import { PermissionCategory } from '../../modules/organisation-permissions/helpers/PermissionCategory';
import { Profile } from '../../modules/profile/entities/profile.entity';
import { Notification } from '../../modules/notifications/entities/notifications.entity';
import { v4 as uuidv4 } from 'uuid';
import { CreateAdminDto } from './dto/admin.dto';
import { ADMIN_CREATED, INVALID_ADMIN_SECRET, SERVER_ERROR } from '../../helpers/SystemMessages';
import { CreateAdminResponseDto } from './dto/create-admin-response.dto';
import { RoleCategory, RoleCategoryDescriptions } from '../../modules/organisation-role/helpers/RoleCategory';
import { DefaultRole } from '../../modules/organisation-role/entities/role.entity';

@Injectable()
export class SeedingService {
  constructor(private readonly dataSource: DataSource) {}

  async seedDatabase() {
    const userRepository = this.dataSource.getRepository(User);
    const profileRepository = this.dataSource.getRepository(Profile);
    const inviteRepository = this.dataSource.getRepository(Invite);
    const organisationRepository = this.dataSource.getRepository(Organisation);
    const productRepository = this.dataSource.getRepository(Product);
    const categoryRepository = this.dataSource.getRepository(ProductCategory);
    const defaultPermissionRepository = this.dataSource.getRepository(DefaultPermissions);
    const notificationRepository = this.dataSource.getRepository(Notification);
    const defaultRoleRepository = this.dataSource.getRepository(DefaultRole);
    try {
      const existingPermissions = await defaultPermissionRepository.count();
      const existingRoles = await defaultRoleRepository.count();

      //Populate the database with default permissions if none exits else stop execution
      if (existingPermissions <= 0) {
        const defaultPermissions = Object.values(PermissionCategory).map(category =>
          defaultPermissionRepository.create({
            category,
            permission_list: false,
          })
        );

        await defaultPermissionRepository.save(defaultPermissions);
      }

      //Populate the database with default Roles if none exits else stop execution
      if (existingRoles <= 0) {
        const defaultRoles = Object.values(RoleCategory).map(name =>
          defaultRoleRepository.create({
            name: name,
            description: RoleCategoryDescriptions[name],
          })
        );

        // Save all default roles to the database
        await defaultRoleRepository.save(defaultRoles);
      }

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      const existingUsers = await userRepository.count();
      if (existingUsers > 0) {
        Logger.log('Database is already populated. Skipping seeding.');
        return;
      }

      try {
        const u1 = userRepository.create({
          first_name: 'John',
          last_name: 'Smith',
          email: 'john.smith@example.com',
          password: 'password',
        });
        const u2 = userRepository.create({
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane.smith@example.com',
          password: 'password',
        });

        await userRepository.save([u1, u2]);

        const savedUsers = await userRepository.find();
        if (savedUsers.length !== 2) {
          throw new Error('Failed to create all users');
        }

        const prf1 = profileRepository.create({
          username: 'Johnsmith',
          email: 'john.smith@example.com',
        });
        const prf2 = profileRepository.create({
          username: 'Janesmith',
          email: 'jane.smith@example.com',
        });

        await profileRepository.save([prf1, prf2]);
        const savedProfiles = await profileRepository.find();

        if (savedProfiles.length !== 2) {
          throw new Error('Failed to create all profiles');
        }

        savedUsers[0].profile = savedProfiles[0];
        savedUsers[1].profile = savedProfiles[1];

        await userRepository.save(savedUsers);

        const or1 = organisationRepository.create({
          name: 'Org 1',
          description: 'Description 1',
          email: 'test1@email.com',
          industry: 'industry1',
          type: 'type1',
          country: 'country1',
          state: 'state1',
          address: 'address1',
          owner: savedUsers[0],
          creator: savedUsers[0],
          isDeleted: false,
        });

        const or2 = organisationRepository.create({
          name: 'Org 2',
          description: 'Description 2',
          email: 'test2@email.com',
          industry: 'industry2',
          type: 'type2',
          country: 'country2',
          state: 'state2',
          address: 'address2',
          owner: savedUsers[0],
          creator: savedUsers[0],
          isDeleted: false,
        });

        await organisationRepository.save([or1, or2]);
        const savedOrganisations = await organisationRepository.find();

        if (savedOrganisations.length !== 2) {
          throw new Error('Failed to create all organisations');
        }

        const c1 = categoryRepository.create({
          name: 'Category 1',
          description: 'Description for Category 1',
        });
        const c2 = categoryRepository.create({
          name: 'Category 2',
          description: 'Description for Category 2',
        });
        const c3 = categoryRepository.create({
          name: 'Category 3',
          description: 'Description for Category 3',
        });

        // Save categories
        await categoryRepository.save([c1, c2, c3]);

        // Create products with associated categories
        const p1 = productRepository.create({
          name: 'Product 1',
          description: 'Description for Product 1',
          size: ProductSizeType.STANDARD,
          quantity: 1,
          price: 500,
          org: or1,
        });
        const p2 = productRepository.create({
          name: 'Product 2',
          description: 'Description for Product 2',
          size: ProductSizeType.LARGE,
          quantity: 2,
          price: 50,
          org: or2,
        });
        const p3 = productRepository.create({
          name: 'Product 2',
          description: 'Description for Product 2',
          size: ProductSizeType.STANDARD,
          quantity: 2,
          price: 50,
          org: or1,
        });
        const p4 = productRepository.create({
          name: 'Product 2',
          description: 'Description for Product 2',
          size: ProductSizeType.SMALL,
          quantity: 2,
          price: 50,
          org: or2,
        });

        await productRepository.save([p1, p2, p3, p4]);

        const savedProducts = await productRepository.find({ relations: ['category'] });
        if (savedProducts.length !== 4) {
          throw new Error('Failed to create all products');
        }

        const inv1 = inviteRepository.create({
          organisation: savedOrganisations[0],
          isGeneric: true,
          isAccepted: false,
          token: uuidv4(),
        });

        const inv2 = inviteRepository.create({
          isGeneric: true,
          isAccepted: false,
          token: uuidv4(),
          organisation: savedOrganisations[1],
        });

        await inviteRepository.save([inv1, inv2]);
        const savedInvite = await inviteRepository.find();
        if (savedInvite.length !== 2) {
          throw new Error('Failed to create all organisations');
        }
        const savedCategories = await categoryRepository.find({ relations: ['products'] });
        if (savedCategories.length !== 3) {
          throw new Error('Failed to create all categories');
        }

        const notifications = [
          notificationRepository.create({
            message: 'Notification 1 for John',
            user: savedUsers[0],
          }),
          notificationRepository.create({
            message: 'Notification 2 for John',
            user: savedUsers[0],
          }),
          notificationRepository.create({
            message: 'Notification 1 for Jane',
            user: savedUsers[1],
          }),
          notificationRepository.create({
            message: 'Notification 2 for Jane',
            user: savedUsers[1],
          }),
        ];

        await notificationRepository.save(notifications);
        const savedNotifications = await notificationRepository.find();
        if (savedNotifications.length !== 4) {
          throw new Error('Failed to create all notifications');
        }

        await queryRunner.commitTransaction();
      } catch (error) {
        await queryRunner.rollbackTransaction();
        console.error('Seeding failed:', error.message);
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      console.error('Error while checking for existing data:', error.message);
    }
  }

  async getUsers(): Promise<User[]> {
    try {
      return this.dataSource.getRepository(User).find();
    } catch (error) {
      console.log('Error fetching users:', error);
      throw new BadRequestException('Error fetching users');
    }
  }

  async createSuperAdmin({ secret, ...adminDetails }: CreateAdminDto): Promise<CreateAdminResponseDto> {
    try {
      const userRepository = this.dataSource.getRepository(User);
      const exists = await userRepository.findOne({ where: { email: adminDetails.email } });
      if (exists) throw new ConflictException('A user already exist with the same email');

      const user = userRepository.create(adminDetails);
      const { ADMIN_SECRET } = process.env;
      if (secret !== ADMIN_SECRET) throw new UnauthorizedException(INVALID_ADMIN_SECRET);

      user.user_type = UserType.SUPER_ADMIN;
      const admin = await userRepository.save(user);
      return { status: 201, message: ADMIN_CREATED, data: admin };
    } catch (error) {
      console.log('Error creating superAdmin:', error);
      if (error instanceof UnauthorizedException || error instanceof ConflictException) throw error;
      throw new InternalServerErrorException(SERVER_ERROR);
    }
  }
}
