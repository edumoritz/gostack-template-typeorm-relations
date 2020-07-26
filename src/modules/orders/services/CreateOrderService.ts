import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) { }

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const productsUpdated: IProduct[] = [];
    let checkStock = false;

    if (!products || !customer_id) {
      throw new AppError('Algo de errado não está certo.');
    }

    const products_ids = await this.productsRepository.findAllById(products);
    const customer = await this.customersRepository.findById(customer_id);

    products.forEach(product => {
      const quantityFind =
        products_ids.find(p => p.id === product.id)?.quantity || 0;

      checkStock = quantityFind - product.quantity < 0;

      productsUpdated.push({
        quantity: quantityFind - product.quantity,
        id: product.id,
      });
    });

    if (!customer) {
      throw new AppError('Customer não existe no banco de dados');
    }
    if (products_ids.length !== products.length) {
      throw new AppError('invalid products.');
    }
    if (checkStock) {
      throw new AppError('Um ou mais produtos fora de estoque.');
    }

    const listProducts = products_ids.map(res => ({
      product_id: res.id,
      price: res.price,
      quantity: products.find(value => value.id === res.id)?.quantity || 0,
    }));

    await this.productsRepository.updateQuantity(productsUpdated);

    const order = await this.ordersRepository.create({
      customer,
      products: listProducts,
    });

    return order;
  }
}

export default CreateOrderService;
