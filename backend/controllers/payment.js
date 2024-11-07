import { stripe } from '../lib/stripe.js';
import Coupon from '../models/cupon.js';
import Order from '../models/order.js';

/**
 * Create a Stripe checkout session for the given products and coupon code.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Array} req.body.products - The products to purchase, in the format of
 *   { id, quantity, price }.
 * @param {string} [req.body.couponCode] - The coupon code to apply, if any.
 *
 * @returns {Promise<Object>} - A promise that resolves to an object with the
 *   following properties:
 *   - id: the ID of the Stripe checkout session.
 *   - totalAmount: the total amount of the purchase in dollars.
 */
export const createCheckoutSession = async (req, res) => {
  try {
    const { products, couponCode } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty products array' });
    }

    let totalAmount = 0;

    const lineItems = products.map((product) => {
      const amount = Math.round(product.price * 100); //convert to paisa 

      return {
        price_data: {
          currency: 'inr',
          product_data: {
            name: product.name,
            images: [product.image],
          },
          unit_amount: amount,
        },
        quantity: product.quantity || 1,
      };
    });

    let coupon = null;
    if (couponCode) {
      coupon = await Coupon.findOne({
        code: couponCode,
        userId: req.user._id,
        isActive: true,
      });
      if (coupon) {
        totalAmount -= Math.round(
          (totalAmount * coupon.discountPercentage) / 100
        );
      }
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL}/purchase-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/purchase-cancel`,
      discounts: coupon
        ? [
            {
              coupon: await createStripeCoupon(coupon.discountPercentage),
            },
          ]
        : [],
      metadata: {
        userId: req.user._id.toString(),
        couponCode: couponCode || '',
        products: JSON.stringify(
          products.map((p) => ({
            id: p._id,
            quantity: p.quantity,
            price: p.price,
          }))
        ),
      },
    });

    if (totalAmount >= 20000) {
      await createNewCoupon(req.user._id);
    }
    res.status(200).json({ id: session.id, totalAmount: totalAmount / 100 });
  } catch (error) {
    console.error('Error processing checkout:', error);
    res
      .status(500)
      .json({ message: 'Error processing checkout', error: error.message });
  }
};

/**
 * Handles a successful checkout, deactivates the coupon if used, and creates a
 * new Order.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.body.sessionId - The Stripe session ID.
 *
 * @returns {Object} - An object with a success message and the ID of the new
 *   order.
 */
export const checkoutSuccess = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      if (session.metadata.couponCode) {
        await Coupon.findOneAndUpdate(
          {
            code: session.metadata.couponCode,
            userId: session.metadata.userId,
          },
          {
            isActive: false,
          }
        );
      }

      // create a new Order
      const products = JSON.parse(session.metadata.products);
      const newOrder = new Order({
        user: session.metadata.userId,
        products: products.map((product) => ({
          product: product.id,
          quantity: product.quantity,
          price: product.price,
        })),
        totalAmount: session.amount_total / 100, 
        stripeSessionId: sessionId,
      });

      await newOrder.save();

      res.status(200).json({
        success: true,
        message:
          'Payment successful, order created, and coupon deactivated if used.',
        orderId: newOrder._id,
      });
    }
  } catch (error) {
    console.error('Error processing successful checkout:', error);
    res.status(500).json({
      message: 'Error processing successful checkout',
      error: error.message,
    });
  }
};

/**
 * Creates a Stripe coupon with the given discount percentage. The coupon will
 * have a duration of 'once', meaning it can only be used once.
 *
 * @param {Number} discountPercentage - The discount percentage for the coupon.
 *
 * @returns {Promise<string>} - The ID of the newly created Stripe coupon.
 */
async function createStripeCoupon(discountPercentage) {
  const coupon = await stripe.coupons.create({
    percent_off: discountPercentage,
    duration: 'once',
  });

  return coupon.id;
}

/**
 * Creates a new coupon for a given user, deletes any existing coupon for that user,
 * and returns the newly created coupon.
 *
 * @param {string} userId - The ID of the user for whom the coupon is created.
 *
 * @returns {Promise<Object>} - A promise that resolves to the newly created coupon object.
 */
async function createNewCoupon(userId) {
  await Coupon.findOneAndDelete({ userId });

  const newCoupon = new Coupon({
    code: 'GIFT' + Math.random().toString(36).substring(2, 8).toUpperCase(),
    discountPercentage: 10,
    expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    userId: userId,
  });

  await newCoupon.save();

  return newCoupon;
}
